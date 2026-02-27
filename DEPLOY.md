# 🚀 Deployment Guide (EC2 + Nginx + FastAPI)

This guide explains how to deploy the **Ai-checker** project on AWS EC2 using Nginx, Gunicorn, and FastAPI.

---

## 🌐 Step 0: Create AWS Account & EC2 Instance

1. Create an AWS account at https://aws.amazon.com/
2. Launch an EC2 Instance:
   - OS: Ubuntu (Recommended 22.04 LTS)
   - Instance Type: t2.micro (Free tier) or higher based on requirement
   - Create / Select Key Pair
   - Configure Security Group (IMPORTANT)

### 🔐 Security Group Rules

| Type | Protocol | Port Range | Source |
|------|----------|------------|--------|
| HTTP | TCP | 80 | 0.0.0.0/0 |
| Custom TCP | TCP | 0-65535 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |
| SSH | TCP | 22 | 103.59.75.109/32 |

---

# 🖥 Backend Deployment (FastAPI)

---

## Step 1: Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## Step 2: Update & Install Dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv git nginx -y
```

---

## Step 3: Clone the Project

```bash
git clone https://github.com/Durgeshhhhhh/Ai-checker/
cd Ai-checker
```

---

## Step 4: Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn uvicorn
```

---

## Step 5: Create `.env` File

```bash
sudo nano .env
```

Add your environment variables and save.

---

## Step 6: Run Gunicorn (Test Manually)

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:8000
```

If working properly, stop it using `CTRL + C`.

---

## Step 7: Create Systemd Service (Auto Start)

```bash
sudo nano /etc/systemd/system/ai-detector.service
```

Paste:

```
[Unit]
Description=AI Detector FastAPI App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/Ai-checker
ExecStart=/home/ubuntu/Ai-checker/venv/bin/gunicorn -w 1 -k uvicorn.workers.UvicornWorker app:app --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### Reload & Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl start ai-detector
sudo systemctl enable ai-detector
```

### Check Status

```bash
sudo systemctl status ai-detector
```

---

# 🌍 Configure Nginx (Backend Reverse Proxy)

---

## Step 8: Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/Ai-checker
```

Paste:

```
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable configuration:

```bash
sudo ln -s /etc/nginx/sites-available/Ai-checker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

# 🎨 Frontend Deployment (Production Build)

---

## Step 9: Build Frontend

Install Node.js & npm (if not installed):

```bash
sudo apt install npm -y
```

Build project:

```bash
npm run build
```

This creates a `dist/` folder for production.

---

## Step 10: Move `dist` to Nginx Directory

```bash
sudo rm -rf /var/www/aichecker
sudo mkdir -p /var/www/aichecker
sudo cp -r ~/Ai-checker/dist/* /var/www/aichecker/
sudo chown -R www-data:www-data /var/www/aichecker
sudo chmod -R 755 /var/www/aichecker
```

---

## Step 11: Update Nginx for Frontend + Backend

```bash
sudo nano /etc/nginx/sites-available/default
```

Replace with:

```
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    root /var/www/aichecker;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Step 12: Restart Nginx

```bash
sudo systemctl restart nginx
```

---

# ✅ Final Result

- Backend running via Gunicorn (Port 8000)
- Nginx serving frontend
- API connected via `/api/`
- Project accessible via:

```
http://YOUR_EC2_PUBLIC_IP
```

---

# 🔥 Production Tips

- Use a domain instead of IP
- Setup SSL with Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx
```
- Use proper environment variables
- Disable port `0-65535` rule after deployment (for security)

---

# 🎯 Deployment Complete!

Your FastAPI + Nginx + EC2 deployment is now production-ready 🚀
