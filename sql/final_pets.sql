-- KoleGame FINAL PET CATALOG v2
-- Safe for existing players. No profile/coin/pet rows are deleted or reset.
-- Run after shop_pets.sql. This only replaces the server-side catalog.

create or replace function public.kg_pet_catalog()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('key','chick','name','جوجه طلایی','icon','pet','rarity','معمولی','base_cost',1000,'income',3,'unlock_level',1),
    jsonb_build_object('key','bunny','name','خرگوش زمردی','icon','pet','rarity','معمولی','base_cost',1800,'income',5,'unlock_level',1),
    jsonb_build_object('key','slime','name','اسلایم زمردی','icon','pet','rarity','معمولی','base_cost',2600,'income',7,'unlock_level',2),
    jsonb_build_object('key','hamster','name','همستر گنج‌یاب','icon','pet','rarity','معمولی','base_cost',3500,'income',9,'unlock_level',2),
    jsonb_build_object('key','cat','name','گربه پول‌ساز','icon','pet','rarity','غیرمعمول','base_cost',4500,'income',8,'unlock_level',3),
    jsonb_build_object('key','panda','name','پاندای ثروتمند','icon','pet','rarity','غیرمعمول','base_cost',7000,'income',13,'unlock_level',4),
    jsonb_build_object('key','raccoon','name','راکون دزد سکه','icon','pet','rarity','غیرمعمول','base_cost',10000,'income',17,'unlock_level',5),
    jsonb_build_object('key','owl','name','جغد دانا','icon','pet','rarity','غیرمعمول','base_cost',18000,'income',28,'unlock_level',6),
    jsonb_build_object('key','fox','name','روباه نقره‌ای','icon','pet','rarity','کمیاب','base_cost',12000,'income',18,'unlock_level',5),
    jsonb_build_object('key','penguin','name','پنگوئن سرمایه‌دار','icon','pet','rarity','کمیاب','base_cost',30000,'income',42,'unlock_level',8),
    jsonb_build_object('key','bee','name','زنبور طلایی','icon','pet','rarity','کمیاب','base_cost',40000,'income',55,'unlock_level',9),
    jsonb_build_object('key','shark','name','کوسه طلایی','icon','pet','rarity','کمیاب','base_cost',50000,'income',65,'unlock_level',10),
    jsonb_build_object('key','parrot','name','طوطی جواهرنشان','icon','pet','rarity','کمیاب','base_cost',75000,'income',90,'unlock_level',12),
    jsonb_build_object('key','tiger','name','ببر سلطنتی','icon','pet','rarity','کمیاب','base_cost',140000,'income',170,'unlock_level',15),
    jsonb_build_object('key','dragon','name','اژدهای زمردی','icon','pet','rarity','حماسی','base_cost',85000,'income',110,'unlock_level',12),
    jsonb_build_object('key','manta','name','پرتوی آبی','icon','pet','rarity','حماسی','base_cost',180000,'income',230,'unlock_level',17),
    jsonb_build_object('key','unicorn','name','تک‌شاخ کیهانی','icon','pet','rarity','حماسی','base_cost',220000,'income',280,'unlock_level',18),
    jsonb_build_object('key','griffin','name','گریفین باستانی','icon','pet','rarity','حماسی','base_cost',380000,'income',470,'unlock_level',22),
    jsonb_build_object('key','wolf','name','گرگ سایه‌ای','icon','pet','rarity','حماسی','base_cost',900000,'income',1050,'unlock_level',30),
    jsonb_build_object('key','phoenix','name','ققنوس سلطنتی','icon','pet','rarity','افسانه‌ای','base_cost',600000,'income',720,'unlock_level',25),
    jsonb_build_object('key','dragonfire','name','اژدهای آتشین','icon','pet','rarity','افسانه‌ای','base_cost',1200000,'income',1450,'unlock_level',33),
    jsonb_build_object('key','robot','name','ربات خزانه‌دار','icon','pet','rarity','افسانه‌ای','base_cost',1500000,'income',1800,'unlock_level',35),
    jsonb_build_object('key','mecha-dragon','name','اژدهای مکا','icon','pet','rarity','افسانه‌ای','base_cost',2800000,'income',3300,'unlock_level',42),
    jsonb_build_object('key','kraken','name','کراکن طلایی','icon','pet','rarity','اسطوره‌ای','base_cost',4000000,'income',4800,'unlock_level',50),
    jsonb_build_object('key','celestial','name','شیر آسمانی','icon','pet','rarity','اسطوره‌ای','base_cost',8500000,'income',9200,'unlock_level',58),
    jsonb_build_object('key','cosmic','name','پت کیهانی','icon','pet','rarity','اسطوره‌ای','base_cost',12000000,'income',15000,'unlock_level',70),
    jsonb_build_object('key','starwhale','name','نهنگ ستاره‌ای','icon','pet','rarity','اسطوره‌ای','base_cost',20000000,'income',23000,'unlock_level',78),
    jsonb_build_object('key','void','name','نگهبان خلأ','icon','pet','rarity','اسطوره‌ای','base_cost',30000000,'income',30000,'unlock_level',85)
  );
$$;

grant execute on function public.kg_pet_catalog() to authenticated;
