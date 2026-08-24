-- d:\IUH\NAM4\HK2_2025_2026\BigData\CAB-BOOKING\database_test\user-seed.sql

-- 1. Profile Khách hàng (0909123456)
INSERT INTO users (user_id, role, account_status, full_name, display_name, phone, email)
VALUES ('f4f1bf52-6c73-42a1-8098-8bb47d9db828', 'customer', 'active', 'Phan Quoc Kiet', 'Kiet Phan', '0909123456', 'kiet.phan@example.com')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO wallet_accounts (wallet_account_id, user_id, balance, currency, status)
VALUES (gen_random_uuid(), 'f4f1bf52-6c73-42a1-8098-8bb47d9db828', 1000000, 'VND', 'ACTIVE')
ON CONFLICT (user_id) DO NOTHING;

-- 2. Profile Tài xế 1 (0909000999)
INSERT INTO users (user_id, role, account_status, full_name, display_name, phone, email)
VALUES ('d24b3038-f1ab-4ab2-9e9d-16be02bd5eb2', 'driver', 'active', 'Tai Xe Mock', 'Driver 01', '0909000999', 'driver@test.com')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO driver_profiles (user_id, kyc_status, approval_status, vehicle_type, license_number)
VALUES ('d24b3038-f1ab-4ab2-9e9d-16be02bd5eb2', 'VERIFIED', 'APPROVED', 'bike', '59-P1 12345')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Profile Tài xế 2 (0908888777) - ĐÂY LÀ PHẦN BỔ SUNG ĐỂ KHỚP VỚI AUTH-SEED
INSERT INTO users (user_id, role, account_status, full_name, display_name, phone, email)
VALUES ('7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d', 'driver', 'active', 'Trần Văn Lái', 'Lái Xe Pro', '0908888777', 'lai.tran@example.com')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO driver_profiles (user_id, kyc_status, approval_status, vehicle_type, license_number)
VALUES ('7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d', 'VERIFIED', 'APPROVED', 'car', '51G-888.88')
ON CONFLICT (user_id) DO NOTHING;
