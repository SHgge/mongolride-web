-- ============================================================
-- EP-06 P0-5: Seed MN templates covering the cross-epic map.
-- One template per (key, locale, channel) — version 1, is_active=true.
--
-- Categories:
--   transactional   — RSVP confirm, membership decisions, ticket
--   event_lifecycle — reminders, changes, cancel, check-in
--   weather         — alerts (severe / hazardous bypass DND)
--   system          — admin alerts, provider down
-- ============================================================

-- Helper macro: each call inserts both email + in_app rows in one block.

-- =========================
-- EP-02 membership
-- =========================
insert into public.notification_templates (key, locale, channel, category, version, is_active, subject_md, body_md, variables) values
('membership.approved', 'mn', 'email', 'transactional', 1, true,
 '{{club_name}} клубт тавтай морилно уу!',
 $md$## Сайн байна уу{{#member_name}}, {{member_name}}{{/member_name}}!

Таны элсэх хүсэлт **зөвшөөрөгдлөө**. Та одоо клубын бүрэн эрхт гишүүн боллоо.

[Удахгүй болох эвентүүдийг харах]({{events_url}})$md$,
 '[{"name":"club_name","type":"string","required":true,"example":"MongolRide"},
   {"name":"member_name","type":"string","example":"Бат"},
   {"name":"events_url","type":"url","required":true,"example":"https://ubriders-club.vercel.app/events"}]'::jsonb),

('membership.approved', 'mn', 'in_app', 'transactional', 1, true,
 'Клубт тавтай морилно уу',
 'Та одоо {{club_name}} клубын гишүүн боллоо.',
 '[{"name":"club_name","type":"string","required":true}]'::jsonb),

('membership.rejected', 'mn', 'email', 'transactional', 1, true,
 '{{club_name}} элсэх хүсэлтийн хариу',
 $md$Сайн байна уу{{#member_name}}, {{member_name}}{{/member_name}},

Бид таны элсэх хүсэлтийг **энэ удаад зөвшөөрөх боломжгүй** болсонд харамсаж байна.

{{#reason}}**Шалтгаан:** {{reason}}{{/reason}}

Дараа дахин оролдох эсвэл бидэнтэй холбогдох боломжтой.$md$,
 '[{"name":"club_name","type":"string","required":true},
   {"name":"member_name","type":"string"},
   {"name":"reason","type":"string","example":"Гишүүний хүчин чадал хязгаартай байна"}]'::jsonb),

('membership.rejected', 'mn', 'in_app', 'transactional', 1, true,
 'Элсэх хүсэлтийн хариу',
 'Таны хүсэлт энэ удаад зөвшөөрөгдсөнгүй.{{#reason}} {{reason}}{{/reason}}',
 '[{"name":"reason","type":"string"}]'::jsonb),

-- =========================
-- EP-03 RSVP / event lifecycle
-- =========================
('event.rsvp_confirmed', 'mn', 'email', 'transactional', 1, true,
 'RSVP баталгаажлаа — {{event_title}}',
 $md$## {{event_title}}

Таны бүртгэл амжилттай.

- **Уулзах цаг:** {{meet_at_local}}
- **Уулзах газар:** {{meet_location}}
{{#required_gear}}- **Шаардагдах хэрэгсэл:** {{required_gear}}{{/required_gear}}

[Миний QR / ticket нээх]({{ticket_url}})

Эвент дээр зохион байгуулагчид энэ QR-ыг үзүүлж check-in хийнэ үү.$md$,
 '[{"name":"event_title","type":"string","required":true},
   {"name":"meet_at_local","type":"date","required":true},
   {"name":"meet_location","type":"string","required":true},
   {"name":"required_gear","type":"string"},
   {"name":"ticket_url","type":"url","required":true}]'::jsonb),

('event.rsvp_confirmed', 'mn', 'in_app', 'transactional', 1, true,
 'RSVP баталгаажлаа: {{event_title}}',
 '{{meet_at_local}} — {{meet_location}}',
 '[{"name":"event_title","type":"string","required":true},
   {"name":"meet_at_local","type":"date","required":true},
   {"name":"meet_location","type":"string","required":true},
   {"name":"link","type":"url"}]'::jsonb),

('event.rsvp_promoted_from_waitlist', 'mn', 'email', 'transactional', 1, true,
 'Хүлээгдсэн жагсаалтаас баталгаажлаа — {{event_title}}',
 $md$Сайн мэдээ! **{{event_title}}** эвентэд таны хүсэлт **зөвшөөрөгдлөө**.

- **Уулзах цаг:** {{meet_at_local}}
- **Уулзах газар:** {{meet_location}}

[Тасалбараа нээх]({{ticket_url}})$md$,
 '[{"name":"event_title","type":"string","required":true},
   {"name":"meet_at_local","type":"date","required":true},
   {"name":"meet_location","type":"string","required":true},
   {"name":"ticket_url","type":"url","required":true}]'::jsonb),

('event.rsvp_promoted_from_waitlist', 'mn', 'in_app', 'transactional', 1, true,
 'Хүлээгдсэн жагсаалтаас баталгаажлаа: {{event_title}}',
 'Та одоо оролцох эрхтэй боллоо.',
 '[{"name":"event_title","type":"string","required":true},{"name":"link","type":"url"}]'::jsonb),

('event.reminder.t_24h', 'mn', 'email', 'event_lifecycle', 1, true,
 'Маргааш {{event_title}} эхлэнэ',
 $md$## {{event_title}}

24 цагийн дотор эхлэх гэж байна.

- **Уулзах цаг:** {{meet_at_local}}
- **Уулзах газар:** {{meet_location}}
{{#required_gear}}- **Шаардагдах хэрэгсэл:** {{required_gear}}{{/required_gear}}
{{#weather_section}}

{{{weather_section}}}{{/weather_section}}

[Дэлгэрэнгүй]({{event_url}})$md$,
 '[{"name":"event_title","type":"string","required":true},
   {"name":"meet_at_local","type":"date","required":true},
   {"name":"meet_location","type":"string","required":true},
   {"name":"required_gear","type":"string"},
   {"name":"weather_section","type":"string"},
   {"name":"event_url","type":"url","required":true}]'::jsonb),

('event.reminder.t_24h', 'mn', 'in_app', 'event_lifecycle', 1, true,
 'Сануулга: {{event_title}}',
 '{{meet_at_local}} — {{meet_location}}',
 '[{"name":"event_title","type":"string","required":true},{"name":"meet_at_local","type":"date"},{"name":"meet_location","type":"string"},{"name":"link","type":"url"}]'::jsonb),

('event.reminder.t_3h', 'mn', 'email', 'event_lifecycle', 1, true,
 '3 цагийн дараа {{event_title}}',
 $md$**{{event_title}}** удахгүй эхэлнэ.

- **Уулзах цаг:** {{meet_at_local}}
- **Уулзах газар:** {{meet_location}}
{{#weather_section}}

{{{weather_section}}}{{/weather_section}}$md$,
 '[{"name":"event_title","type":"string","required":true},
   {"name":"meet_at_local","type":"date","required":true},
   {"name":"meet_location","type":"string","required":true},
   {"name":"weather_section","type":"string"}]'::jsonb),

('event.reminder.t_3h', 'mn', 'in_app', 'event_lifecycle', 1, true,
 '3 цагийн дараа: {{event_title}}',
 '{{meet_location}}',
 '[{"name":"event_title","type":"string"},{"name":"meet_location","type":"string"},{"name":"link","type":"url"}]'::jsonb),

('event.reminder.t_30m', 'mn', 'email', 'event_lifecycle', 1, true,
 '30 минутын дараа эхлэнэ — {{event_title}}',
 $md${{event_title}} удахгүй эхэлнэ. Уулзах цэг рүү замдаа мордоорой.

{{#aqi_warning}}**PM2.5 маск (KN95/N95) хэрэглэхээ мартуузай.** AQI {{aqi_us}}{{/aqi_warning}}$md$,
 '[{"name":"event_title","type":"string","required":true},{"name":"aqi_warning","type":"string"},{"name":"aqi_us","type":"number"}]'::jsonb),

('event.reminder.t_30m', 'mn', 'in_app', 'event_lifecycle', 1, true,
 '30 минутын дараа: {{event_title}}',
 'Замдаа мордоорой.',
 '[{"name":"event_title","type":"string","required":true},{"name":"link","type":"url"}]'::jsonb),

('event.changed', 'mn', 'email', 'event_lifecycle', 1, true,
 'Өөрчлөлт оров — {{event_title}}',
 $md$**{{event_title}}** эвентэд өөрчлөлт оров.

{{#changes}}- {{.}}{{/changes}}

[Дэлгэрэнгүй]({{event_url}})$md$,
 '[{"name":"event_title","type":"string","required":true},{"name":"changes","type":"string"},{"name":"event_url","type":"url","required":true}]'::jsonb),

('event.changed', 'mn', 'in_app', 'event_lifecycle', 1, true,
 'Эвент шинэчлэгдлээ: {{event_title}}',
 'Эвент мэдээлэл өөрчлөгдсөн байна.',
 '[{"name":"event_title","type":"string","required":true},{"name":"link","type":"url"}]'::jsonb),

('event.cancelled', 'mn', 'email', 'event_lifecycle', 1, true,
 'Цуцлагдлаа — {{event_title}}',
 $md$Уучлаарай — **{{event_title}}** эвент цуцлагдлаа.

{{#reason}}**Шалтгаан:** {{reason}}{{/reason}}

[Бусад эвентүүдийг харах]({{events_url}})$md$,
 '[{"name":"event_title","type":"string","required":true},{"name":"reason","type":"string"},{"name":"events_url","type":"url","required":true}]'::jsonb),

('event.cancelled', 'mn', 'in_app', 'event_lifecycle', 1, true,
 'Эвент цуцлагдлаа: {{event_title}}',
 '{{#reason}}{{reason}}{{/reason}}',
 '[{"name":"event_title","type":"string","required":true},{"name":"reason","type":"string"},{"name":"link","type":"url"}]'::jsonb),

('event.checked_in', 'mn', 'in_app', 'event_lifecycle', 1, true,
 'Check-in хийгдлээ: {{event_title}}',
 'Сайн аялал болоорой!',
 '[{"name":"event_title","type":"string","required":true},{"name":"link","type":"url"}]'::jsonb),

-- =========================
-- EP-05 weather alerts (severe categories bypass DND)
-- =========================
('weather.cold', 'mn', 'email', 'weather', 1, true,
 'Хүйтний анхааруулга — {{event_title}}',
 $md$**{{event_title}}** эвентэд хүйтний эрсдэл.

- Температур: **{{temp_c}}°C**
{{#feels_like_c}}- Биеийн мэдрэмж: {{feels_like_c}}°C{{/feels_like_c}}

Заавал нүүр амны хамгаалалт, дулаан давхарга, цөмөг (pogies) өмссөн байх ёстой. -25°C-аас доош үед бараг нүцгэн арьсанд 10–30 минутын дараа хөлдөх эрсдэлтэй.

[Эвентийн дэлгэрэнгүй]({{event_url}})$md$,
 '[{"name":"event_title","type":"string","required":true},{"name":"temp_c","type":"number"},{"name":"feels_like_c","type":"number"},{"name":"event_url","type":"url","required":true}]'::jsonb),

('weather.cold', 'mn', 'in_app', 'weather', 1, true,
 'Хүйтэн: {{event_title}}',
 'Температур {{temp_c}}°C — дулаан хувцас заавал.',
 '[{"name":"event_title","type":"string","required":true},{"name":"temp_c","type":"number","required":true},{"name":"link","type":"url"}]'::jsonb),

('weather.wind', 'mn', 'email', 'weather', 1, true,
 'Хүчтэй салхины анхааруулга — {{event_title}}',
 $md$**{{event_title}}** эвентэд хүчтэй салхины эрсдэл.

Салхи: **{{wind_speed_ms}} м/с**

Хүнд сэрс ачаалал, унаны баланс эрсдэлтэй. Эвентийг хойшлуулах эсвэл цуцлахаар хянагтун.$md$,
 '[{"name":"event_title","type":"string","required":true},{"name":"wind_speed_ms","type":"number","required":true}]'::jsonb),

('weather.wind', 'mn', 'in_app', 'weather', 1, true,
 'Хүчтэй салхи: {{event_title}}',
 'Салхи {{wind_speed_ms}} м/с',
 '[{"name":"event_title","type":"string","required":true},{"name":"wind_speed_ms","type":"number","required":true},{"name":"link","type":"url"}]'::jsonb),

('weather.aqi', 'mn', 'email', 'weather', 1, true,
 'Агаарын чанарын анхааруулга — {{event_title}}',
 $md$**{{event_title}}** эвентэд агаарын чанарын эрсдэл.

- AQI: **{{aqi_us}}**
{{#pm10_ugm3}}- PM10: {{pm10_ugm3}} µg/m³{{/pm10_ugm3}}

PM2.5 хамгаалалттай маск (KN95/N95) заавал хэрэглэх. Боломжтой бол эвентийг AQI < 100 болох хүртэл хүлээх.$md$,
 '[{"name":"event_title","type":"string","required":true},{"name":"aqi_us","type":"number","required":true},{"name":"pm10_ugm3","type":"number"}]'::jsonb),

('weather.aqi', 'mn', 'in_app', 'weather', 1, true,
 'AQI өндөр: {{event_title}}',
 'AQI {{aqi_us}} — маск хэрэглэнэ үү.',
 '[{"name":"event_title","type":"string","required":true},{"name":"aqi_us","type":"number","required":true},{"name":"link","type":"url"}]'::jsonb),

('weather.dust', 'mn', 'email', 'weather', 1, true,
 'Шороон шуурга — {{event_title}}',
 $md$**{{event_title}}** эвентэд шороон шуурга. Харагдах зай бага, зам аюултай. Эвент цуцлахаар хянагтун.$md$,
 '[{"name":"event_title","type":"string","required":true}]'::jsonb),

('weather.dust', 'mn', 'in_app', 'weather', 1, true,
 'Шороон шуурга: {{event_title}}',
 'Шуурга — эвент цуцлах эрсдэлтэй.',
 '[{"name":"event_title","type":"string","required":true},{"name":"link","type":"url"}]'::jsonb),

('weather.thunderstorm', 'mn', 'email', 'weather', 1, true,
 'Аянгат бороо — {{event_title}}',
 $md$**{{event_title}}** эвентэд аянгад цохиулах эрсдэлтэй. Эвентийг хойшлуулах эсвэл цуцлахаар хянагтун.$md$,
 '[{"name":"event_title","type":"string","required":true}]'::jsonb),

('weather.thunderstorm', 'mn', 'in_app', 'weather', 1, true,
 'Аянгат бороо: {{event_title}}',
 'Эрсдэлтэй — эвент цуцлахаар хянагтун.',
 '[{"name":"event_title","type":"string","required":true},{"name":"link","type":"url"}]'::jsonb),

-- =========================
-- system
-- =========================
('system.notification_provider_down', 'mn', 'in_app', 'system', 1, true,
 'И-мэйлийн үйлчилгээ доголдож байна',
 'Хэдэн notification дамжуулагдах боломжгүй байна. Resend dashboard шалгаарай.',
 '[]'::jsonb);
