from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware 
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
from jose import jwt
from auth_utils import hash_password, verify_password, create_access_token, decode_token, SECRET_KEY, ALGORITHM
from models import User, Car
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import asyncio
from fastapi.responses import StreamingResponse
from carAgent import QueueCallbackHandler, car_agent

Base.metadata.create_all(bind=engine)
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

security = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str, db: Session):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401)
    return user

class UserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False

class UserLogin(BaseModel):
    username: str
    password: str

class CarCreate(BaseModel):
    make: str
    model: str
    year: int
    body_style: str
    price: str
    mileage: str
    engine: str
    image: str

@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_password = hash_password(user.password)
    new_user = User(username=user.username, hashed_password=hashed_password, is_admin=user.is_admin)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "username": new_user.username, "id": new_user.id}

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create user response without password
    user_response = {
        "id": db_user.id,
        "username": db_user.username,
        "is_admin": db_user.is_admin
    }
    
    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer", "user": user_response}

@app.get("/cars")
def get_cars(db: Session = Depends(get_db)):
    return db.query(Car).all()

from sqlalchemy import func

@app.get("/cars/body-styles")
def get_body_styles(db: Session = Depends(get_db)):
    
    results = db.query(
        func.lower(Car.body_style).label('body_style_lower'),
        Car.body_style.label('body_style_original')
    ).filter(
        Car.body_style.isnot(None),
        Car.body_style != ''
    ).group_by(
        func.lower(Car.body_style)
    ).order_by(
        func.lower(Car.body_style)
    ).all()
    
    body_styles = []
    seen = set()
    
    for row in results:
        lower_style = row.body_style_lower
        if lower_style not in seen:
            example = db.query(Car.body_style).filter(
                func.lower(Car.body_style) == lower_style
            ).first()
            
            body_styles.append({
                "name": example[0] if example else row.body_style_original
            })
            seen.add(lower_style)
    
    return body_styles

@app.post("/admin/cars")
def add_car(car: CarCreate, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    # Verify token and admin status
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    new_car = Car(**car.dict())
    db.add(new_car)
    db.commit()
    return {"message": "Car added"}

@app.delete("/admin/cars/{car_id}")
def delete_car(car_id: int, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    car = db.query(Car).get(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    db.delete(car)
    db.commit()
    return {"message": "Car deleted"}

from typing import Optional

@app.get('/protected')
def protected_route(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Credentials missing")
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or Expired Token")
    
    return {"message": "Protected route accessed", "user": payload["sub"]}

async def token_generator(content: str, streamer: QueueCallbackHandler):
    """
    Kicks off the agent as a background task and streams SSE tokens
    from the queue as they arrive.  Ends naturally when the streamer
    yields its last token (i.e. after <<DONE>> is consumed internally).
    """
    task = asyncio.create_task(
        car_agent.invoke(input=content, streamer=streamer)
    )

    async for token in streamer:
        # streamer.__aiter__ already filters <<STEP_END>> and <<DONE>>
        if token:
            yield token

    # Ensure the agent task is fully awaited before the response closes
    try:
        await task
    except Exception as e:
        print(f"Agent task error: {e}", flush=True)


@app.get("/ai/vehicle-summary-stream/{car_id}")
async def vehicle_summary_stream(car_id: int, db: Session = Depends(get_db)):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    vehicle_prompt = (
        f"Make: {car.make}\n"
        f"Model: {car.model}\n"
        f"Year: {car.year}\n"
        f"Body Style: {car.body_style}\n"
        f"Price: {car.price}\n"
        f"Mileage: {car.mileage}\n"
        f"Engine: {car.engine}\n\n"
        "Write a friendly and engaging sales pitch explaining why this vehicle is a great choice. "
        "Keep it conversational and appealing to a potential buyer."
    )

    queue: asyncio.Queue = asyncio.Queue()
    streamer = QueueCallbackHandler(queue)

    return StreamingResponse(
        token_generator(vehicle_prompt, streamer),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )