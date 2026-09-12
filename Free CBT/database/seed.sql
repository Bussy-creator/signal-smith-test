-- Sample seed data for local development
insert into courses (code, title, department, level, semester) values
  ('MTS 101', 'Elementary Mathematics I', 'Mathematics', 100, 1),
  ('MTS 102', 'Elementary Mathematics II', 'Mathematics', 100, 2),
  ('MTS 104', 'Elementary Set Theory', 'Mathematics', 100, 2),
  ('PHY 101', 'General Physics I', 'Physics', 100, 1),
  ('STA 101', 'Descriptive Statistics', 'Statistics', 100, 1);

insert into topics (course_id, name)
select id, t.name from courses c
cross join (values ('Algebra'),('Trigonometry'),('Limits & Continuity')) as t(name)
where c.code = 'MTS 101';

insert into topics (course_id, name)
select id, t.name from courses c
cross join (values ('Mechanics'),('Vectors'),('Kinematics')) as t(name)
where c.code = 'PHY 101';
