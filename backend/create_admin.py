import argparse
import getpass
import bcrypt
from app.database import SessionLocal
from app.models.user import User

def create_admin():
    print("=== Create Admin Account ===")
    
    # Prompt for user details
    username = input("Username: ").strip()
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")
    confirm_password = getpass.getpass("Confirm Password: ")
    
    if password != confirm_password:
        print("Error: Passwords do not match.")
        return
    
    if not username or not email or not password:
        print("Error: Username, email, and password are required.")
        return

    # Hash the password
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter((User.email == email) | (User.username == username)).first()
        
        if existing_user:
            if existing_user.email == email:
                print(f"User with email '{email}' already exists. Promoting to admin...")
            else:
                print(f"User with username '{username}' already exists. Promoting to admin...")
            
            existing_user.role = "admin"
            # Optional: update password if you want
            # existing_user.password_hash = password_hash
            db.commit()
            print("Successfully promoted existing user to admin!")
        else:
            # Create new admin user
            new_admin = User(
                username=username,
                email=email,
                password_hash=password_hash,
                role="admin"
            )
            db.add(new_admin)
            db.commit()
            print("Successfully created new admin account!")
            
    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
