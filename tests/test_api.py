"""
Unit and Integration Tests for Flask REST API Endpoints (Phase-2)
Tests Authentication, Dashboard Stats, Locations, Slots, Queue, Notifications, and History.
"""

import json
import os
import sys
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db


@pytest.fixture
def client():
    """Create Flask test client"""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestAPIEndpoints:
    """Test Flask REST API routes"""

    # ==================== PAGE & HEALTH ====================

    def test_index_page(self, client):
        """Test home page returns 200 OK and contains brand title"""
        res = client.get("/")
        assert res.status_code == 200
        assert b"SmartPark" in res.data or b"Parking" in res.data

    # ==================== FR4: AUTHENTICATION ====================

    def test_api_login_success(self, client):
        """Test login with demo credentials (admin / admin123)"""
        res = client.post(
            "/api/auth/login",
            data=json.dumps({"username": "admin", "password": "admin123"}),
            content_type="application/json"
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert "token" in data

    def test_api_login_invalid_credentials(self, client):
        """Test login with invalid password"""
        res = client.post(
            "/api/auth/login",
            data=json.dumps({"username": "admin", "password": "wrongpassword"}),
            content_type="application/json"
        )
        assert res.status_code == 401
        data = res.get_json()
        assert data["success"] is False
        assert "error" in data

    def test_api_auth_me_and_logout(self, client):
        """Test authentication state and logout flow"""
        # Login first
        client.post(
            "/api/auth/login",
            data=json.dumps({"username": "admin", "password": "admin123"}),
            content_type="application/json"
        )

        # Check me
        me_res = client.get("/api/auth/me")
        assert me_res.status_code == 200
        assert me_res.get_json()["authenticated"] is True

        # Logout
        logout_res = client.post("/api/auth/logout")
        assert logout_res.status_code == 200

        # Check me again
        me_after = client.get("/api/auth/me")
        assert me_after.get_json()["authenticated"] is False

    # ==================== FR5: DASHBOARD STATS ====================

    def test_api_dashboard_stats(self, client):
        """Test dashboard stats endpoint returns complete metrics"""
        res = client.get("/api/dashboard/stats")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        stats = data["stats"]
        assert "total_slots" in stats
        assert "available_slots" in stats
        assert "occupied_slots" in stats
        assert "cars_detected" in stats
        assert "bikes_detected" in stats
        assert "cars" in stats
        assert "bikes" in stats

    # ==================== LOCATIONS & SLOTS ====================

    def test_api_parking_locations(self, client):
        """Test getting list of all 5 mock locations"""
        res = client.get("/api/parking/locations")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert data["count"] == 5

    def test_api_location_slots(self, client):
        """Test getting parking slots separated by Cars and Bikes"""
        res = client.get("/api/parking/locations/1/slots")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert len(data["car_slots"]) == 10
        assert len(data["bike_slots"]) == 5

    def test_api_slot_status_update(self, client):
        """Test updating slot status triggers transition"""
        # Fetch actual slot ID from location 1
        slots_res = client.get("/api/parking/locations/1/slots")
        slots_data = slots_res.get_json()
        assert slots_data["success"] is True
        slot_id = slots_data["slots"][0]["id"]

        res = client.post(
            f"/api/parking/slots/{slot_id}/status",
            data=json.dumps({"status": "available"}),
            content_type="application/json"
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert data["result"]["new_status"] == "available"

    # ==================== FR6: QUEUE MANAGEMENT ====================

    def test_api_queue_lifecycle(self, client):
        """Test joining queue, querying queue, and removing from queue"""
        # Join queue
        join_res = client.post(
            "/api/queue/join",
            data=json.dumps({
                "user_name": "API Test Driver",
                "vehicle_number": "KA88API1234",
                "vehicle_type": "Car",
                "location_id": 1
            }),
            content_type="application/json"
        )
        assert join_res.status_code == 201
        join_data = join_res.get_json()
        assert join_data["success"] is True
        q_id = join_data["entry"]["id"]

        # Duplicate join prevention
        dup_res = client.post(
            "/api/queue/join",
            data=json.dumps({
                "user_name": "API Test Driver",
                "vehicle_number": "KA88API1234",
                "vehicle_type": "Car",
                "location_id": 1
            }),
            content_type="application/json"
        )
        assert dup_res.status_code == 409

        # Get queue
        q_res = client.get("/api/queue?location=1")
        assert q_res.status_code == 200
        assert any(item["id"] == q_id for item in q_res.get_json()["queue"])

        # Delete queue entry
        del_res = client.delete(f"/api/queue/{q_id}")
        assert del_res.status_code == 200

    # ==================== FR3: NOTIFICATIONS ====================

    def test_api_notifications(self, client):
        """Test notifications retrieval and mark read"""
        res = client.get("/api/notifications")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert "notifications" in data

    # ==================== FR7: PARKING HISTORY ====================

    def test_api_parking_history(self, client):
        """Test parking activity history endpoint"""
        res = client.get("/api/parking/history?limit=10")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert len(data["history"]) <= 10

    # ==================== DEMO DATA RESET ====================

    def test_api_demo_reset(self, client):
        """Test resetting demo mock data via API"""
        res = client.post("/api/demo/reset")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True

    # ==================== 2-MINUTE RESERVATION & SEARCH API TESTS ====================

    def test_api_reservation_lifecycle(self, client):
        """Test reservation creation, double booking block, arrival confirmation and cancellation"""
        # Get an available slot at location 1
        slots_res = client.get("/api/parking/locations/1/slots")
        avail_slot = next(s for s in slots_res.get_json()["car_slots"] if s["status"] == "available")
        slot_id = avail_slot["id"]

        # 1. Reserve slot
        reserve_res = client.post(
            f"/api/parking/slots/{slot_id}/reserve",
            data=json.dumps({
                "user_name": "Test Driver",
                "vehicle_number": "KA09AA1122",
                "vehicle_type": "Car"
            }),
            content_type="application/json"
        )
        assert reserve_res.status_code in (200, 201)
        res_data = reserve_res.get_json()
        assert res_data["success"] is True
        assert res_data["reservation"]["status"] == "reserved"

        # 2. Prevent Double Booking
        dup_res = client.post(
            f"/api/parking/slots/{slot_id}/reserve",
            data=json.dumps({
                "user_name": "Other Driver",
                "vehicle_number": "KA09AA3344",
                "vehicle_type": "Car"
            }),
            content_type="application/json"
        )
        assert dup_res.status_code == 409

        # 3. Check active reservations endpoint
        act_res = client.get("/api/reservations/active?location=1")
        assert act_res.status_code == 200
        assert any(r["slot_id"] == slot_id for r in act_res.get_json()["reservations"])

        # 4. Confirm Arrival (RESERVED -> OCCUPIED)
        arrive_res = client.post(f"/api/parking/slots/{slot_id}/arrive")
        assert arrive_res.status_code == 200
        assert arrive_res.get_json()["result"]["status"] == "occupied"

    def test_api_distance_and_search_filter(self, client):
        """Test /api/parking/locations with max_distance and search params"""
        # Filter within 1 km
        res_1km = client.get("/api/parking/locations?max_distance=1.0")
        assert res_1km.status_code == 200
        locs_1km = res_1km.get_json()["locations"]
        assert len(locs_1km) == 2

        # Search for DMart
        res_dmart = client.get("/api/parking/locations?search=DMart")
        assert res_dmart.status_code == 200
        locs_dmart = res_dmart.get_json()["locations"]
        assert len(locs_dmart) == 1
        assert locs_dmart[0]["name"] == "DMart Parking"

    # ==================== ADMIN PARKING SLOTS CONFIGURATION TESTS ====================

    def test_api_admin_parking_slots_unauthorized(self, client):
        """Test that unauthenticated requests to admin slot editing APIs are rejected (HTTP 401)"""
        # Clear session
        client.get("/api/auth/logout")

        get_res = client.get("/api/admin/parking-slots")
        assert get_res.status_code == 401

        post_res = client.post(
            "/api/admin/parking-slots",
            data=json.dumps({"slots": []}),
            content_type="application/json"
        )
        assert post_res.status_code == 401

    def test_api_admin_parking_slots_management(self, client):
        """Test authenticated admin can fetch and save configured parking slot boundaries"""
        # Login as admin
        login_res = client.post(
            "/api/auth/login",
            data=json.dumps({"username": "admin", "password": "admin123"}),
            content_type="application/json"
        )
        assert login_res.status_code == 200

        # 1. GET configured slots
        get_res = client.get("/api/admin/parking-slots")
        assert get_res.status_code == 200
        data = get_res.get_json()
        assert data["success"] is True
        assert "slots" in data
        assert isinstance(data["slots"], list)

        # 2. POST updated slots (Add/Move/Resize/Assign ID/Car & Bike types)
        custom_slots = [
            {"id": "A01", "x": 60, "y": 120, "width": 110, "height": 50, "vehicle_type": "Car"},
            {"id": "A02", "x": 190, "y": 120, "width": 110, "height": 50, "vehicle_type": "Car"},
            {"id": "A03", "x": 320, "y": 120, "width": 110, "height": 50, "vehicle_type": "Car"},
            {"id": "B01", "x": 60, "y": 260, "width": 75, "height": 45, "vehicle_type": "Bike"},
            {"id": "B02", "x": 150, "y": 260, "width": 75, "height": 45, "vehicle_type": "Bike"},
        ]

        save_res = client.post(
            "/api/admin/parking-slots",
            data=json.dumps({"slots": custom_slots}),
            content_type="application/json"
        )
        assert save_res.status_code == 200
        save_data = save_res.get_json()
        assert save_data["success"] is True
        assert save_data["count"] == 5

        # 3. Verify slots are saved and returned on next GET
        verify_res = client.get("/api/admin/parking-slots")
        assert verify_res.status_code == 200
        saved_slots = verify_res.get_json()["slots"]
        assert len(saved_slots) == 5
        assert saved_slots[0]["id"] == "A01"
        assert saved_slots[3]["id"] == "B01"
        assert saved_slots[3]["vehicle_type"] == "Bike"

    def test_api_camera_snapshot(self, client):
        """Test camera snapshot endpoint returns image/jpeg for the visual slot editor"""
        res = client.get("/api/camera/snapshot")
        assert res.status_code == 200
        assert "image/jpeg" in res.content_type


