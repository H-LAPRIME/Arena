let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Force HTTPS for production (Hugging Face)
if (API_URL.includes("hf.space") && API_URL.startsWith("http://")) {
  API_URL = API_URL.replace("http://", "https://");
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("efootball_token") : null;

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: "Request failed" }));
    // Si c'est une erreur 422, on jette l'objet entier pour que le frontend puisse le parser
    const error: any = new Error(typeof errData.detail === 'string' ? errData.detail : "Validation Error");
    error.detail = errData.detail;
    error.status = res.status;
    throw error;
  }

  return res.json();
}

// Auth
export const authApi = {
  register: (data: { username: string; email: string; password: string; avatar_url?: string }) =>
    apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => apiFetch("/api/auth/me"),
};

// Users
export const usersApi = {
  getAll: () => apiFetch("/api/users"),
  getOne: (id: string) => apiFetch(`/api/users/${id}`),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  adminCreate: (data: Record<string, any>) =>
    apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
  adminUpdate: (id: string, data: Record<string, any>) =>
    apiFetch(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
  updateUserAvatar: (userId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch(`/api/admin/users/${userId}/avatar`, { method: "POST", body: form });
  },
  getNotifications: () => apiFetch("/api/users/me/notifications"),
  markNotificationRead: (id: string) => apiFetch(`/api/users/me/notifications/${id}/read`, { method: "PUT" }),
  updateProfile: (data: { username?: string; password?: string; old_password?: string }) =>
    apiFetch("/api/users/me", { method: "PUT", body: JSON.stringify(data) }),
  updateAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch("/api/users/me/avatar", { method: "POST", body: form });
  },
};

// Leagues
export const leaguesApi = {
  getAll: () => apiFetch("/api/leagues/"),
  getOne: (id: string) => apiFetch(`/api/leagues/${id}`),
  create: (data: Record<string, any>) =>
    apiFetch("/api/leagues", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/api/admin/leagues/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/admin/leagues/${id}`, { method: "DELETE" }),
  join: (join_code: string) => apiFetch("/api/leagues/join", { method: "POST", body: JSON.stringify({ join_code }) }),
  getMy: () => apiFetch("/api/leagues/my"),
  getMembers: (id: string) => apiFetch(`/api/leagues/${id}/members`),
  getStandings: (id: string) => apiFetch(`/api/leagues/${id}/standings`),
  getMatches: (id: string) => apiFetch(`/api/leagues/${id}/matches`),
  getStandingAdvice: (id: string) => apiFetch(`/api/leagues/${id}/standing-advice`),
  getH2HAdvice: (id: string, opponentId: string) => apiFetch(`/api/leagues/${id}/h2h-advice/${opponentId}`),
  getMatchAdvice: (matchId: string) => apiFetch(`/api/leagues/match-advice/${matchId}`),
  quit: (id: string) => apiFetch(`/api/leagues/${id}/quit`, { method: "DELETE" }),
};

// Matches
export const matchesApi = {
  getAll: () => apiFetch("/api/admin/matches"),
  getOne: (id: string) => apiFetch(`/api/admin/matches/${id}`),
  create: (data: Record<string, any>) =>
    apiFetch("/api/admin/matches", { method: "POST", body: JSON.stringify(data) }),
  adminUpdate: (id: string, data: Record<string, any>) =>
    apiFetch(`/api/admin/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/admin/matches/${id}`, { method: "DELETE" }),
  recordScore: (id: string, home_score: number, away_score: number) =>
    apiFetch(`/api/matches/${id}/score`, {
      method: "PUT",
      body: JSON.stringify({ home_score, away_score }),
    }),
};

// Claims
export const claimsApi = {
  submit: (matchId: string, home_score: number, away_score: number, screenshot?: File) => {
    const form = new FormData();
    form.append("match_id", matchId);
    form.append("home_score", String(home_score));
    form.append("away_score", String(away_score));
    if (screenshot) form.append("screenshot", screenshot);
    return apiFetch("/api/claims", { method: "POST", body: form });
  },
  getAll: (status?: string) => apiFetch(`/api/admin/claims${status ? `?status_filter=${status}` : ""}`),
  getMy: () => apiFetch("/api/claims/my"),
  approve: (id: string, admin_note?: string) =>
    apiFetch(`/api/admin/claims/${id}/approve`, { method: "PUT", body: JSON.stringify({ status: "approved", admin_note }) }),
  reject: (id: string, admin_note?: string) =>
    apiFetch(`/api/admin/claims/${id}/reject`, { method: "PUT", body: JSON.stringify({ status: "rejected", admin_note }) }),
  delete: (id: string) => apiFetch(`/api/claims/${id}`, { method: "DELETE" }),
  updateImage: (id: string, screenshot: File) => {
    const form = new FormData();
    form.append("screenshot", screenshot);
    return apiFetch(`/api/claims/${id}/image`, { method: "PATCH", body: form });
  },
};

// Certificates
export const certificatesApi = {
  downloadFile: async (endpoint: string, filename: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("efootball_token") : null;
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  downloadTitle: (leagueId: string, leagueName: string) => 
    certificatesApi.downloadFile(`/api/certificates/title/${leagueId}`, `Champion_${leagueName}.pdf`),
  downloadLord: () => 
    certificatesApi.downloadFile(`/api/certificates/lord`, `Lord_of_the_Arena.pdf`),
  downloadReport: (leagueId: string, leagueName: string, username: string) => 
    certificatesApi.downloadFile(`/api/certificates/report/${leagueId}`, `Report_${leagueName}_${username}.pdf`),
};

// Stats
export const statsApi = {
  headToHead: (id1: string, id2: string) => apiFetch(`/api/stats/head-to-head/${id1}/${id2}`),
  records: () => apiFetch("/api/stats/records"),
  player: (id: string) => apiFetch(`/api/stats/player/${id}`),
};

// Chat
export const chatApi = {
  send: (message: string, user_id?: string) =>
    apiFetch("/api/chat", { method: "POST", body: JSON.stringify({ message, user_id }) }),
  history: (limit?: number) => apiFetch(`/api/chat/history?limit=${limit || 50}`),
  clearHistory: () => apiFetch("/api/chat/history", { method: "DELETE" }),
};
