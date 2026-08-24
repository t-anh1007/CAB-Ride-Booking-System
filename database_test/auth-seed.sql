

-- 1. Tài khoản KHÁCH HÀNG (0909123456)
INSERT INTO auth_accounts (id, subject_id, destination, destination_type, status)
VALUES ('1b754468-8f4c-4cd9-b4d8-6923316625ae', 'f4f1bf52-6c73-42a1-8098-8bb47d9db828', '0909123456', 'phone', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO account_roles (account_id, role)
VALUES ('1b754468-8f4c-4cd9-b4d8-6923316625ae', 'customer')
ON CONFLICT DO NOTHING;

-- 2. Tài khoản TÀI XẾ 1 (0909000999)
INSERT INTO auth_accounts (id, subject_id, destination, destination_type, status)
VALUES ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'd24b3038-f1ab-4ab2-9e9d-16be02bd5eb2', '0909000999', 'phone', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO account_roles (account_id, role)
VALUES ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'driver')
ON CONFLICT DO NOTHING;

-- 3. Tài khoản TÀI XẾ 2 (0908888777)
INSERT INTO auth_accounts (id, subject_id, destination, destination_type, status, created_at, updated_at)
VALUES ('d99636a4-6d9a-4328-b21d-decd8bbb81e1', '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d', '0908888777', 'phone', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO account_roles (account_id, role)
VALUES ('d99636a4-6d9a-4328-b21d-decd8bbb81e1', 'driver') -- Gán quyền driver cho TK này
ON CONFLICT DO NOTHING;
