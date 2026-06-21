import httpx
from typing import Optional
from sqlalchemy.orm import Session
from app.models.standing import Standing
from app.models.match import Match
from app.models.user import User
from app.models.chat import ChatMessage
from app.models.league import League
from app.models.result_claim import ResultClaim
from app.config import get_settings
import uuid

settings = get_settings()

SYSTEM_PROMPT = """You are the official AI coach of eFootball Arena, a private football challenge platform between friends.
Your role is to:
1. Analyze each player's current standing in their league.
2. Give personalized tactical and motivational advice based on their stats.
3. Comment on recent match results.
4. Warn about rivals closing in on the leaderboard.
Your tone is direct, analytical, and encouraging — like a real coach.
Keep responses concise (3-4 sentences max). No emojis. Respond in the same language the user messages in (default English)."""


async def build_league_context(db: Session, user_id: str, league_id: Optional[str] = None) -> str:
    """Build a context string for the AI about the user's current league state."""

    # Find the most relevant league for this user
    if not league_id:
        from app.models.league_member import LeagueMember
        membership = (
            db.query(LeagueMember)
            .join(League, League.id == LeagueMember.league_id)
            .filter(
                LeagueMember.user_id == user_id,
                League.status == "active",
            )
            .first()
        )
        if membership:
            league_id = membership.league_id

    user = db.query(User).filter(User.id == user_id).first()
    context = f"Player: {user.username if user else 'Unknown'}\n"
    context += f"Total trophies: {user.total_trophies if user else 0}\n"
    context += f"Lord of the Game: {'Yes' if user and user.is_lord else 'No'}\n\n"

    if not league_id:
        context += "Player is not currently in an active league.\n"
        return context

    league = db.query(League).filter(League.id == league_id).first()
    if league:
        context += f"League: {league.name} (Status: {league.status})\n\n"

    # Standings
    standings = (
        db.query(Standing)
        .filter(Standing.league_id == league_id)
        .order_by(Standing.points.desc())
        .all()
    )
    if standings:
        context += "=== CURRENT STANDINGS ===\n"
        for i, s in enumerate(standings):
            u = db.query(User).filter(User.id == s.user_id).first()
            name = u.username if u else "?"
            marker = " <-- THIS PLAYER" if s.user_id == user_id else ""
            context += f"{i+1}. {name}: {s.points}pts | W{s.wins} D{s.draws} L{s.losses}{marker}\n"

    # Recent matches for this user
    recent = (
        db.query(Match)
        .filter(
            Match.league_id == league_id,
            Match.status == "played",
            (Match.home_player_id == user_id) | (Match.away_player_id == user_id),
        )
        .order_by(Match.played_at.desc())
        .limit(3)
        .all()
    )
    if recent:
        context += "\n=== RECENT MATCHES ===\n"
        for m in recent:
            home = db.query(User).filter(User.id == m.home_player_id).first()
            away = db.query(User).filter(User.id == m.away_player_id).first()
            context += f"- {home.username if home else '?'} vs {away.username if away else '?'} ({m.home_score}-{m.away_score})\n"

    # Pending matches
    pending_count = (
        db.query(Match)
        .filter(
            Match.league_id == league_id,
            Match.status == "pending",
            (Match.home_player_id == user_id) | (Match.away_player_id == user_id),
        )
        .count()
    )
    context += f"\nPending matches remaining: {pending_count}\n"

    return context


async def get_ai_advice_for_user(db: Session, user_id: str, league_id: Optional[str] = None) -> str:
    """Generate personalized AI advice for a user based on their league state."""
    if not settings.MISTRAL_API_KEY:
        return ""

    context = await build_league_context(db, user_id, league_id)
    prompt = f"Based on this data, give this player specific advice for their next match and their league campaign:\n\n{context}"
    return await _call_mistral(db, prompt, user_id, save=False)


async def chat_with_ai(db: Session, user_message: str, user_id: str, league_id: Optional[str] = None) -> str:
    """User-facing chat: answer a question with full league context."""
    if not settings.MISTRAL_API_KEY:
        return "AI is not configured. Add MISTRAL_API_KEY to your .env file."

    context = await build_league_context(db, user_id, league_id)
    system = f"{SYSTEM_PROMPT}\n\nCurrent game context:\n{context}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 400,
                    "temperature": 0.7,
                },
            )
            data = response.json()
            reply = data["choices"][0]["message"]["content"]
    except Exception as e:
        reply = f"AI is temporarily unavailable. ({str(e)})"

    # Save chat history
    db.add(ChatMessage(id=str(uuid.uuid4()), user_id=user_id, role="user", content=user_message))
    db.add(ChatMessage(id=str(uuid.uuid4()), user_id=user_id, role="assistant", content=reply))
    db.commit()

    return reply


async def generate_match_comment(db: Session, match: Match) -> str:
    """Generate a brief post-match AI comment."""
    if not settings.MISTRAL_API_KEY:
        return ""

    home = db.query(User).filter(User.id == match.home_player_id).first()
    away = db.query(User).filter(User.id == match.away_player_id).first()
    h_name = home.username if home else "Player"
    a_name = away.username if away else "Player"

    prompt = (
        f"Briefly comment on this eFootball result (2 sentences, no emojis, analytical tone): "
        f"{h_name} {match.home_score} - {match.away_score} {a_name} (Match day {match.match_day})."
    )
    return await _call_mistral(db, prompt, user_id=None, save=False)


async def generate_standing_comment(db: Session, user_id: str, league_id: str) -> str:
    """Comment on the user's position in the standings."""
    context = await build_league_context(db, user_id, league_id)
    prompt = f"Analyze my position in the standings and give me a 2-sentence tactical observation based on the gap with rivals:\n\n{context}"
    return await _call_mistral(db, prompt, user_id, save=False)


async def generate_h2h_comment(db: Session, user_id: str, opponent_id: str) -> str:
    """Comment on the head-to-head stats against a specific opponent."""
    user = db.query(User).filter(User.id == user_id).first()
    opp = db.query(User).filter(User.id == opponent_id).first()
    
    # Simple H2H stats
    matches = db.query(Match).filter(
        Match.status == "played",
        ((Match.home_player_id == user_id) & (Match.away_player_id == opponent_id)) |
        ((Match.home_player_id == opponent_id) & (Match.away_player_id == user_id))
    ).all()
    
    u_wins = 0
    o_wins = 0
    draws = 0
    for m in matches:
        if m.home_score == m.away_score: draws += 1
        elif (m.home_player_id == user_id and m.home_score > m.away_score) or \
             (m.away_player_id == user_id and m.away_score > m.home_score):
            u_wins += 1
        else:
            o_wins += 1
            
    prompt = (
        f"Describe and analyze this eFootball Head-to-Head record: {user.username} has {u_wins} wins, "
        f"{opp.username} has {o_wins} wins, and there are {draws} draws. "
        f"Start by briefly describing the balance of power, then give a tactical advice to {user.username}. "
        f"Keep it to 2-3 sentences, direct tone, no emojis."
    )
    return await _call_mistral(db, prompt, user_id, save=False)


async def generate_approval_comment(db: Session, user_id: str, match_id: str) -> str:
    """Congratulate or console after match approval."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match: return ""
    
    is_home = match.home_player_id == user_id
    score_me = match.home_score if is_home else match.away_score
    score_opp = match.away_score if is_home else match.home_score
    
    result = "win" if score_me > score_opp else "draw" if score_me == score_opp else "loss"
    opponent = db.query(User).filter(User.id == (match.away_player_id if is_home else match.home_player_id)).first()
    
    prompt = (
        f"I just got my match result approved: {score_me}-{score_opp} against {opponent.username}. "
        f"Give me a 2-sentence 'coach' feedback based on this {result}."
    )
    return await _call_mistral(db, prompt, user_id, save=False)


async def _call_mistral(db: Session, prompt: str, user_id: Optional[str], save: bool = True) -> str:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return ""
