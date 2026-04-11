from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List
from pydantic import BaseModel, Field

from models import User, UserActivity, PaperTrade
from auth_utils import get_db, get_admin_user, log_user_activity

router = APIRouter(prefix="/api/admin", tags=["admin"])

class ActivityResponse(BaseModel):
    id: int
    user_id: int
    username: str
    action_type: str
    details: str | None
    timestamp: datetime
    
    class Config:
        from_attributes = True

class RoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(ADMIN|USER)$")

@router.get("/users")
def get_all_users(db: Session = Depends(get_db), current_admin: User = Depends(get_admin_user)):
    users = db.query(User).all()
    user_data = []
    for u in users:
        # Get count of trades
        trade_count = db.query(PaperTrade).join(User.portfolios).filter(User.id == u.id).count()
        last_login = db.query(func.max(UserActivity.timestamp)).filter(UserActivity.user_id == u.id, UserActivity.action_type == "LOGIN").scalar()
        
        user_data.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "total_trades": trade_count,
            "last_login": last_login
        })
    return user_data

@router.get("/activity", response_model=List[ActivityResponse])
def get_recent_activity(limit: int = 50, db: Session = Depends(get_db), current_admin: User = Depends(get_admin_user)):
    activities = db.query(UserActivity, User.username).join(User).order_by(UserActivity.timestamp.desc()).limit(limit).all()
    
    res = []
    for act, uname in activities:
        res.append({
            "id": act.id,
            "user_id": act.user_id,
            "username": uname,
            "action_type": act.action_type,
            "details": act.details,
            "timestamp": act.timestamp
        })
    return res

@router.get("/stats")
def get_system_stats(db: Session = Depends(get_db), current_admin: User = Depends(get_admin_user)):
    total_users = db.query(User).count()
    total_trades = db.query(PaperTrade).count()
    
    last_24h = datetime.utcnow() - timedelta(days=1)
    active_users_24h = db.query(UserActivity.user_id).filter(UserActivity.timestamp >= last_24h).distinct().count()
    
    return {
        "status": "healthy",
        "total_users": total_users,
        "total_paper_trades": total_trades,
        "active_users_24h": active_users_24h
    }

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int, 
    req: RoleUpdateRequest, 
    db: Session = Depends(get_db), 
    current_admin: User = Depends(get_admin_user)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Preventing self-demotion to avoid lockout
    if target_user.id == current_admin.id and req.role != "ADMIN":
        raise HTTPException(status_code=400, detail="Cannot demote yourself to prevent system lockout")

    old_role = target_user.role
    target_user.role = req.role
    db.commit()
    
    log_user_activity(
        db, 
        current_admin.id, 
        "ROLE_CHANGE", 
        f"Promoted/Demoted {target_user.username} from {old_role} to {req.role}"
    )
    
    return {"message": f"Successfully updated {target_user.username} to {req.role}"}
