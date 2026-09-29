-- 1) Create the first Super Admin user in Supabase Dashboard:
-- Authentication -> Users -> Add user -> Create new user.
-- 2) Replace the email below with that user's email and run this SQL.

insert into public.profiles (id,user_id,email,full_name,role,active)
select id,id,email,coalesce(raw_user_meta_data->>'full_name',split_part(email,'@',1)),'Super Admin',true
from auth.users
where lower(email)=lower('YOUR_SUPER_ADMIN_EMAIL')
on conflict (id) do update set
  email=excluded.email,
  full_name=excluded.full_name,
  role='Super Admin',
  active=true,
  updated_at=now();

-- Verify:
select user_id,email,full_name,role,active from public.profiles
where role='Super Admin';


-- Standard SE faculty feedback questionnaire (5=Excellent, 4=Very Good, 3=Good, 2=Satisfactory, 1=Poor).
insert into public.axial_v3_questions (hod_login_id,year_level,position,question_text,response_type,required,active) values
('sonalirangdale@scoe.edu','SE',1,'Language used is easy and simple to understand the concepts.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',2,'Ability to deliver Subject Knowledge.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',3,'Timely completion of Theory and practical syllabus of the subject.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',4,'Timely assessment of the Assignments, Unit Test etc.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',5,'Uses teaching aids like LCD, PPT, Videos etc.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',6,'Interacts with the students as and when required even outside the classroom.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',7,'Discuss practical applications.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',8,'Regularity and Punctuality.','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',9,'Experiential Learning activities conducted (Storytelling, Group discussion, Activity Based Learning methods).','rating_1_5',true,true),
('sonalirangdale@scoe.edu','SE',10,'Motivates Students to study the subject and contents beyond syllabus.','rating_1_5',true,true)
 on conflict do nothing;
