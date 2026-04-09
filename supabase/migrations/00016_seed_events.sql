-- Жишээ арга хэмжээнүүд
INSERT INTO events (title, description, event_date, end_date, meeting_address, max_participants, status) VALUES
(
  'Хаврын нээлтийн унаа',
  'Хаврын улирлын нээлтийн арга хэмжээ. Туул голын дагуух маршрутаар хамтдаа дугуйлна. Бүх түвшний дугуйчдад тохиромжтой.',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days' + INTERVAL '4 hours',
  'Зайсан толгой, Улаанбаатар',
  50,
  'upcoming'
),
(
  'Тэрэлж хамтын унаа',
  'Тэрэлжийн байгалийн цогцолбор газар руу нэг өдрийн хамтын унаа. 45 км маршрут, дунд түвшний хэцүү байдал.',
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days' + INTERVAL '8 hours',
  'Чингис хааны талбай',
  30,
  'upcoming'
),
(
  'Шөнийн дугуй - Full Moon Ride',
  'Сарны гэрэлд хотын дугуйн замаар. LED гэрэл заавал авч ирэх. Хурд: 15-20 км/ц.',
  NOW() + INTERVAL '3 days',
  NOW() + INTERVAL '3 days' + INTERVAL '3 hours',
  'Сүхбаатарын талбай',
  100,
  'upcoming'
),
(
  'Дугуйн засвар workshop',
  'Дугуйн үндсэн засвар үйлчилгээг сурах workshop. Дугуй авчрах шаардлагагүй, бүх хэрэгсэл бэлэн.',
  NOW() + INTERVAL '5 days',
  NOW() + INTERVAL '5 days' + INTERVAL '2 hours',
  'MongolRide клуб, Баянзүрх',
  20,
  'upcoming'
),
(
  'Хустай унаа - 120км challenge',
  'Зайсан-Хустай маршрутаар 120 км-ийн challenge. Зөвхөн туршлагатай дугуйчдад.',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '10 hours',
  'Зайсан толгой',
  25,
  'completed'
),
(
  'Гэр бүлийн дугуйн өдөр',
  'Хүүхэд, гэр бүлийн гишүүдийн хамт дугуйлах арга хэмжээ. 10 км хялбар маршрут.',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days' + INTERVAL '3 hours',
  'Үндэсний цэцэрлэгт хүрээлэн',
  80,
  'completed'
);
