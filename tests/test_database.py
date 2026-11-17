"""
Unit and Integration Tests for Database Management Module (Phase-2)
Tests FR3 notifications, FR4 admin auth, FR5 stats, FR6 queue, FR7 history, and 5 mock locations.
"""

import os
import sys
import tempfile
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from database import DatabaseManager, hash_password


class TestDatabaseManager:
    """Test DatabaseManager class and all DAL operations"""

    @pytest.fixture
    def test_db(self, tmp_path):
        """Create a fresh isolated SQLite database instance for tests"""
        db_file = str(tmp_path / "test_parking_system.db")
        db_mgr = DatabaseManager(db_path=db_file)
        return db_mgr

    # ==================== FR4: ADMIN AUTHENTICATION TESTS ====================

    def test_admin_authentication_success(self, test_db):
        """Test authentication succeeds with valid credentials"""
        assert test_db.authenticate_admin("admin", "admin123") is True

    def test_admin_authentication_failure(self, test_db):
        """Test authentication fails with incorrect password or username"""
        assert test_db.authenticate_admin("admin", "wrong_password") is False
        assert test_db.authenticate_admin("nonexistent_user", "admin123") is False
        assert test_db.authenticate_admin("", "") is False

    # ==================== 5 MOCK LOCATIONS TESTS ====================

    def test_mock_locations_seeding(self, test_db):
        """Test that all 5 mock locations are seeded with correct slot counts and distances"""
        locations = test_db.get_locations()
        assert len(locations) == 5

        loc_names = [l["name"] for l in locations]
        assert "NMIT Main Gate Parking" in loc_names
        assert "NMIT Academic Block Parking" in loc_names
        assert "NMIT Library Parking" in loc_names
        assert "NMIT Hostel Parking" in loc_names
        assert "DMart Parking" in loc_names

        # Main Gate should have 10 car slots and 5 bike slots (total 15), distance 0.4km
        main_gate = next(l for l in locations if l["code"] == "NMIT_MAIN")
        assert main_gate["total_cars"] == 10
        assert main_gate["total_bikes"] == 5
        assert main_gate["total_slots"] == 15
        assert main_gate["distance_km"] == 0.4

    # ==================== CARS & BIKES SEPARATION TESTS ====================

    def test_car_and_bike_slots_separation(self, test_db):
        """Test that car slots and bike slots are distinct and separately queryable"""
        car_slots = test_db.get_slots(location_id=1, vehicle_type="Car")
        bike_slots = test_db.get_slots(location_id=1, vehicle_type="Bike")

        assert len(car_slots) == 10
        assert len(bike_slots) == 5
        assert all(s["vehicle_type"] == "Car" for s in car_slots)
        assert all(s["vehicle_type"] == "Bike" for s in bike_slots)
        assert all(s["slot_number"].startswith("A") for s in car_slots)
        assert all(s["slot_number"].startswith("B") for s in bike_slots)

    # ==================== FR3: AVAILABILITY NOTIFICATIONS & QUEUE TRIGGER ====================

    def test_occupied_to_available_transition_triggers_queue_notification(self, test_db):
        """Test that freeing a slot (OCCUPIED -> AVAILABLE) notifies the next waiting user in queue"""
        # Ensure there is a waiting car user in queue for location 1
        queue_before = test_db.get_queue(location_id=1, status="Waiting")
        assert len(queue_before) > 0
        first_waiting_user = queue_before[0]
        first_user_id = first_waiting_user["id"]
        first_user_name = first_waiting_user["user_name"]

        # Find an occupied car slot at location 1 (e.g. A01)
        slots = test_db.get_slots(location_id=1, vehicle_type="Car")
        occupied_slot = next(s for s in slots if s["status"] == "occupied")
        slot_num = occupied_slot["slot_number"]

        # Transition OCCUPIED -> AVAILABLE
        result = test_db.update_slot_status(
            location_id=1,
            slot_number=slot_num,
            new_status="available",
            vehicle_type="Car"
        )

        assert result["success"] is True
        assert result["previous_status"] == "occupied"
        assert result["new_status"] == "available"
        assert result["notification"] is not None

        # Verify the user status in queue transitioned to 'Notified'
        queue_after = test_db.get_queue(location_id=1)
        notified_user = next(u for u in queue_after if u["id"] == first_user_id)
        assert notified_user["status"] == "Notified"
        assert notified_user["notified_at"] is not None

        # Verify notification was recorded in notifications table
        notifs = test_db.get_notifications(limit=10)
        assert any(first_user_name in n["message"] and slot_num in n["message"] for n in notifs)

    # ==================== FR6: QUEUE MANAGEMENT TESTS ====================

    def test_queue_join_and_duplicate_prevention(self, test_db):
        """Test adding vehicle to queue and preventing duplicate vehicle entries"""
        # Add new user to queue
        entry = test_db.join_queue(
            user_name="Test Driver",
            vehicle_number="KA99ZZ9999",
            vehicle_type="Car",
            location_id=1
        )
        assert entry["user_name"] == "Test Driver"
        assert entry["vehicle_number"] == "KA99ZZ9999"
        assert entry["status"] == "Waiting"
        assert entry["position"] >= 1

        # Attempting duplicate entry for the same vehicle plate should raise ValueError
        with pytest.raises(ValueError, match="already in the queue"):
            test_db.join_queue(
                user_name="Another Name",
                vehicle_number="KA99ZZ9999",
                vehicle_type="Car",
                location_id=1
            )

    def test_queue_removal_and_position_reindexing(self, test_db):
        """Test removing a queue item and verifying positions are re-indexed"""
        # Location 3 starts with 0 waiting queue users
        entry1 = test_db.join_queue("User A", "KA99AA1111", "Car", location_id=3)
        entry2 = test_db.join_queue("User B", "KA99BB2222", "Car", location_id=3)
        assert entry1["position"] == 1
        assert entry2["position"] == 2

        # Remove entry1
        success = test_db.remove_from_queue(entry1["id"])
        assert success is True

        # entry2 should now be re-indexed to position 1
        queue_loc3 = test_db.get_queue(location_id=3, status="Waiting")
        rem_user = next(u for u in queue_loc3 if u["id"] == entry2["id"])
        assert rem_user["position"] == 1

    # ==================== FR7: PARKING HISTORY AUDIT LOG TESTS ====================

    def test_parking_history_logging(self, test_db):
        """Test that slot transitions are properly logged into parking history"""
        initial_history = test_db.get_parking_history(location_id=1)
        initial_count = len(initial_history)

        # Update slot status
        test_db.update_slot_status(
            location_id=1,
            slot_number="A02",
            new_status="available",
            vehicle_type="Car"
        )

        new_history = test_db.get_parking_history(location_id=1)
        assert len(new_history) == initial_count + 1
        latest = new_history[0]
        assert latest["slot_number"] == "A02"
        assert latest["new_status"] == "available"
        assert latest["timestamp"] is not None

    # ==================== FR5: DASHBOARD STATS CALCULATION TESTS ====================

    def test_dashboard_stats_calculation(self, test_db):
        """Test overall statistics calculations for total, available, occupied, cars and bikes"""
        stats = test_db.get_dashboard_stats()
        assert stats["total_slots"] > 0
        assert stats["available_slots"] + stats["occupied_slots"] == stats["total_slots"]
        assert stats["cars"]["total"] + stats["bikes"]["total"] == stats["total_slots"]
        assert stats["cars_detected"] == stats["cars"]["occupied"]
        assert stats["bikes_detected"] == stats["bikes"]["occupied"]
        assert 0 <= stats["occupancy_percentage"] <= 100.0

    # ==================== DEMO DATA RESET TESTS ====================

    def test_reset_demo_data(self, test_db):
        """Test resetting demo mock data reloads initial state"""
        test_db.seed_demo_data()
        locations = test_db.get_locations()
        assert len(locations) == 5
        queue = test_db.get_queue()
        assert len(queue) >= 3

    # ==================== 2-MINUTE RESERVATION & DOUBLE-BOOKING TESTS ====================

    def test_slot_reservation_lifecycle(self, test_db):
        """Test reserving an available slot, double booking prevention, and arrival confirmation"""
        # Find an available slot at location 1
        slots = test_db.get_slots(location_id=1, vehicle_type="Car")
        avail_slot = next(s for s in slots if s["status"] == "available")
        slot_num = avail_slot["slot_number"]

        # Reserve the slot for 120s
        res = test_db.reserve_slot(
            location_id=1,
            slot_number=slot_num,
            user_name="John Doe",
            vehicle_number="KA01AB9999",
            vehicle_type="Car",
            duration_seconds=120
        )
        assert res["status"] == "reserved"
        assert res["remaining_seconds"] == 120

        # Verify active reservations query
        active_res = test_db.get_active_reservations(location_id=1)
        assert any(r["slot_number"] == slot_num for r in active_res)

        # Prevent double booking: 2nd user attempting to reserve same slot must fail
        with pytest.raises(ValueError, match="already RESERVED"):
            test_db.reserve_slot(
                location_id=1,
                slot_number=slot_num,
                user_name="Jane Smith",
                vehicle_number="KA02XY8888",
                vehicle_type="Car"
            )

        # Confirm arrival (RESERVED -> OCCUPIED)
        arr_res = test_db.confirm_arrival(slot_num, location_id=1)
        assert arr_res["success"] is True
        assert arr_res["status"] == "occupied"

        # Verify slot is now occupied
        updated_slots = test_db.get_slots(location_id=1, vehicle_type="Car")
        updated = next(s for s in updated_slots if s["slot_number"] == slot_num)
        assert updated["status"] == "occupied"

    def test_distance_filtering_and_search(self, test_db):
        """Test distance filtering (< 1km) and global search"""
        # Nearby within 1 km should return NMIT Main Gate (0.4) and Hostel (0.8)
        nearby = test_db.get_locations(max_distance_km=1.0)
        assert len(nearby) == 2
        names = [l["name"] for l in nearby]
        assert "NMIT Main Gate Parking" in names
        assert "NMIT Hostel Parking" in names
        assert "DMart Parking" not in names

        # Search for DMart (4.2km away) should bypass distance and return DMart
        dmart_res = test_db.get_locations(search_query="DMart")
        assert len(dmart_res) == 1
        assert dmart_res[0]["name"] == "DMart Parking"
        assert dmart_res[0]["distance_km"] == 4.2
