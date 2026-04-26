# Utiliser une image Python légère
FROM python:3.12-slim

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système pour psycopg2 et Pillow
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copier les dépendances et les installer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code du backend
COPY . .

# Créer le dossier d'upload
RUN mkdir -p uploads && chmod 777 uploads

# Hugging Face utilise le port 7860 par défaut
EXPOSE 7860

# Lancer l'application avec Uvicorn sur le port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
