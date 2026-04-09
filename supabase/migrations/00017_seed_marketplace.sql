-- Жишээ зарууд
INSERT INTO listings (title, description, price, category, condition, status, seller_id) VALUES
('Trek Marlin 7 - 2024', 'Маш бага хэрэглэсэн, 29" хэмжээтэй уулын дугуй. Shimano Deore 1x10. Гэрийн хэрэглээнд 3 сар ашигласан.', 2500000, 'bike', 'like_new', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Shimano 105 groupset', 'Shimano 105 R7000 бүрэн groupset. 2x11 хурд. 5000 км явсан, маш сайн нөхцөлтэй.', 450000, 'parts', 'used', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Гар хамгаалалт - Fox Ranger', 'Fox Ranger full finger хамгаалалт. L хэмжээ. Шинэ, хайрцагтай.', 85000, 'accessories', 'new', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Pearl Izumi Jersey - M', 'Pearl Izumi Elite Pursuit LTD Jersey. M хэмжээ. 2 удаа өмссөн.', 65000, 'clothing', 'like_new', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Giant Defy Advanced 2', '2023 он. Carbon frame, Shimano Tiagra. Зам дугуй, маш хурдан. Хот доторх зорчилд тохиромжтой.', 3200000, 'bike', 'used', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Topeak Mini Tool', 'Topeak Mini 20 Pro multi-tool. Шинэ, хэрэглээгүй.', 35000, 'accessories', 'new', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Continental GP5000 28mm', '2 ширхэг зам дугуйн покрышка. 700x28c. 1000 км явсан.', 75000, 'parts', 'used', 'active',
  (SELECT id FROM profiles LIMIT 1)),
('Specialized Stumpjumper - Зарагдсан', 'Specialized Stumpjumper Expert 2023. Full suspension.', 5500000, 'bike', 'used', 'sold',
  (SELECT id FROM profiles LIMIT 1));

-- Жишээ group buy
INSERT INTO group_buys (title, description, product_url, target_quantity, current_quantity, price_per_unit, deadline, status, organizer_id) VALUES
('Shimano SPD-SL Pedal хамтын захиалга', 'Shimano PD-R7000 SPD-SL pedal. Хамтдаа захиалвал хямд. AliExpress-ээс шууд.', 'https://example.com/pedal', 10, 4, 120000,
  NOW() + INTERVAL '14 days', 'open',
  (SELECT id FROM profiles LIMIT 1)),
('Castelli Jersey хамтын захиалга', 'Castelli Competizione 2 Jersey. Бүх хэмжээ. Европоос шууд захиална.', 'https://example.com/jersey', 15, 7, 95000,
  NOW() + INTERVAL '21 days', 'open',
  (SELECT id FROM profiles LIMIT 1));
