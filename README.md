## Digital Car Showroom

This repo contains a react web app with FastAPI backend integrated with Langchain for a generated salespitch.

## Features:
- **FastAPI - backend**
- **ReactJS - frontend**
- **User Authentication**
- **Langchain**
- **Agent Creation**
- **Tool Calling**
- **Prompting**
- **SQLAlechemy - database(local storage)**

## Project Structure

Backend/
│
├── FastAPI/
  │  
  ├── auth_utils.py
  ├── carAgent.py
  ├── database.py
  ├── jwt.py
  ├── models.py
  ├── requirements.txt
├── uv.lock

Frontend/
│
├── node_modules/
├── public/
├── src/
  ├── components/
    ├── AdminPanel.jsx
    ├── Filter.jsx
    ├── Login.jsx
    ├── Signup.jsx
    ├── VehicleCard.jsx
    ├── VehicleDetails.jsx
    ├── VehicleList.jsx
  ├── Api.js
  ├── App.css
  ├── App.js
  ├── index.css
  ├── index.js
├── package-lock.json
├── package.json
