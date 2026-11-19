-- Pages de contenu modifiables depuis l'admin (Maison, Ministères, Extensions, Dons)
-- et inscriptions des enfants à Man Kids.

CREATE TABLE site_sections (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  page       text NOT NULL CHECK (page IN ('maison', 'ministeres', 'extensions', 'dons')),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text NOT NULL,
  subtitle   text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  image_url  text,
  -- Informations pratiques affichées en liste : [{"label": "Adresse", "value": "..."}]
  details    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(details) = 'array'),
  position   integer NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_sections_page_idx ON site_sections (page, position);
CREATE TRIGGER site_sections_updated_at BEFORE UPDATE ON site_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE kids_registration_status AS ENUM ('new', 'contacted', 'enrolled', 'archived');

CREATE TABLE kids_registrations (
  id           text PRIMARY KEY DEFAULT gen_object_id(),
  user_id      text REFERENCES users (id) ON DELETE SET NULL,
  parent_name  text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text,
  child_name   text NOT NULL,
  child_age    integer NOT NULL CHECK (child_age BETWEEN 0 AND 17),
  notes        text NOT NULL DEFAULT '',
  status       kids_registration_status NOT NULL DEFAULT 'new',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kids_registrations_status_idx ON kids_registrations (status, created_at DESC);
CREATE TRIGGER kids_registrations_updated_at BEFORE UPDATE ON kids_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Contenu initial, repris du cahier des charges (docs/contenu-du-site.md)
-- et de la page d'accueil. Les sections sans texte sont créées non publiées :
-- elles apparaîtront sur le site dès qu'un admin les aura complétées et publiées.
-- ---------------------------------------------------------------------------

INSERT INTO site_sections (page, slug, title, subtitle, body, details, position, published) VALUES

-- MAISON
('maison', 'presentation-pasteurs', 'Présentation des pasteurs', 'Prophète Israel Kayembe, Visionnaire',
$t$La Maison d'Adoration pour les Nations est principalement dirigée par le Pasteur et Prophète Israel KAYEMBE, marié à Arlette TSHISWAKA et père de 4 enfants.$t$,
'[]', 10, true),

('maison', 'notre-vision', 'Notre vision', 'Ésaïe 2 : 2-3',
$t$« Ramener les Nations à genoux à la croix par l'Enseignement de la Parole et la Puissance du Saint-Esprit. »

La Maison d'Adoration pour les Nations, M.A.N. en sigle, est une église de courant charismatique fondée en 2019. Elle a son siège social en République Démocratique du Congo, dans la province du Haut-Katanga, à Lubumbashi.$t$,
'[]', 20, true),

('maison', 'notre-culture', 'Notre culture', '', '', '[]', 30, false),
('maison', 'nos-croyances', 'Nos croyances', '', '', '[]', 40, false),
('maison', 'personnel-executif', 'Personnel exécutif', '', '', '[]', 50, false),

('maison', 'contact', 'Contact', 'Nous serons heureux de vous accueillir', '',
'[{"label": "Adresse", "value": "2094, Av. Kapenda, coin Kimbangu, à côté de l''hôpital chinois Ruichen, Lubumbashi"},
  {"label": "Téléphone / WhatsApp", "value": "+243 970 679 649"},
  {"label": "E-mail", "value": "maisondadoration@gmail.com"},
  {"label": "Culte dominical", "value": "Tous les dimanches à 8h30, en personne ou en ligne"}]', 60, true),

-- MINISTÈRES
('ministeres', 'man-kids', 'Man Kids', 'Proverbes 22 : 6',
$t$Bienvenue dans le monde passionnant de Man Kids, où la connaissance de Dieu est au cœur de tout ce que nous faisons !

Chez Man Kids, nous croyons en l'importance d'inscrire chaque enfant sur la voie de la destinée, selon le verset inspirant de Proverbes 22 : 6 : « Instruis l'enfant selon la voie qu'il doit suivre ; et quand il sera vieux, il ne s'en détournera pas. » Dans notre église, nous comprenons que chaque enfant est unique et a un potentiel extraordinaire. C'est pourquoi nous nous engageons à les accompagner dans leur parcours spirituel dès leur plus jeune âge.

Avec notre approche innovante et stimulante, nous offrons des cours amusants et interactifs qui permettent aux enfants de découvrir la Bible, d'explorer leur foi et de grandir dans une relation personnelle avec Dieu. Nous croyons que l'apprentissage ne devrait jamais être ennuyeux, mais plutôt une aventure passionnante et transformatrice.

Rejoignez-nous chez Man Kids, où nous donnons aux enfants les outils nécessaires pour bâtir une fondation solide dans leur foi, afin qu'ils puissent embrasser leur destinée et devenir des leaders spirituels dans leur génération. Accompagnons nos enfants sur la voie qui les mènera vers un avenir radieux et rempli de promesses.$t$,
'[]', 10, true),

('ministeres', 'man-bible-college', 'Man Bible College', 'Discipolat',
$t$Chez Man Bible College, nous croyons que la formation des leaders spirituels est essentielle pour le développement et l'expansion du royaume de Dieu. Notre mission est de fournir une éducation de qualité, ancrée dans la Parole de Dieu, afin de préparer des disciples de Christ prêts à impacter leur génération.

Notre programme de formation est à la fois théorique et pratique : théologie, étude de la Bible, discipolat, leadership et d'autres domaines spécialisés. Nous équipons nos étudiants de connaissances solides et les encourageons à les appliquer dans leur vie quotidienne et leur ministère.

La croissance spirituelle ne se limite pas à la connaissance intellectuelle : elle implique une transformation intérieure et un développement du caractère. Nous mettons l'accent sur l'intégrité, l'amour, la compassion et la sagesse, pour former des leaders qui reflètent l'image de Christ.

À MAN BC, vous serez entouré d'une communauté dynamique et bienveillante d'étudiants passionnés, de professeurs expérimentés et d'ouvriers dévoués, et guidé par des enseignants et mentors attachés à votre développement. Rejoignez-nous pour une formation transformatrice où vous serez équipé, inspiré et encouragé à servir avec excellence.$t$,
'[]', 20, true),

('ministeres', 'jeunesse', 'Jeunesse', '', '', '[]', 30, false),
('ministeres', 'les-soeurs', 'Les sœurs', '', '', '[]', 40, false),
('ministeres', 'grands-jeunes', 'Grands jeunes', '', '', '[]', 50, false),

('ministeres', 'hospitalite', 'L''équipe de l''hospitalité', 'Bienvenue en famille — Welcome home',
$t$Rejoignez-nous chez MAN et découvrez une communauté où l'amour de Dieu se manifeste à travers chaque interaction. Bienvenue en famille !

Chez MAN, nous croyons que l'accueil est bien plus qu'une simple formalité : c'est une véritable invitation à faire partie de notre famille. Nous sommes une église qui accueille avec amour et qui désire que chaque personne qui franchit nos portes se sente véritablement chez elle.

Notre ministère d'accueil et d'hospitalité crée une atmosphère chaleureuse où chacun est valorisé et accueilli avec joie. Que vous soyez un visiteur pour la première fois, un membre régulier ou un ami de longue date, notre équipe est là pour vous accompagner et vous aider à vous sentir pleinement intégré à notre communauté.$t$,
'[]', 60, true),

('ministeres', 'man-worship', 'Man Worship', '', '', '[]', 70, false),

('ministeres', 'psaumes-41', 'Psaumes 41', 'Générosité et service',
$t$Nous vivons la générosité en donnant, en visitant et en servant les autres, répandant l'amour de Dieu et apportant réconfort et soutien aux personnes dans le besoin.

Faites partie de notre ministère de générosité et de service : aidez-nous à répandre l'amour de Dieu.$t$,
'[]', 80, true),

('ministeres', 'morning-prayer', 'Morning Prayer', 'Prière matinale',
$t$Commencez votre journée avec une connexion profonde avec Dieu. Rejoignez-nous pour notre moment de prière matinale et expérimentez la puissance de la prière quotidienne.$t$,
'[]', 90, true),

('ministeres', 'ecole-de-la-sagesse', 'École de la sagesse', '', '', '[]', 100, false),
('ministeres', 'mangroupe', 'Mangroupe — Online Fam', 'Groupes de croissance en ligne et en présentiel', '', '[]', 110, false),

-- EXTENSIONS
('extensions', 'man-lubumbashi', 'MAN Lubumbashi', 'Siège',
'',
'[{"label": "Adresse", "value": "2094, Av. Kapenda, coin Kimbangu, à côté de l''hôpital chinois Ruichen"},
  {"label": "Culte dominical", "value": "Tous les dimanches à 8h30"},
  {"label": "Téléphone", "value": "+243 970 679 649"}]', 10, true),
('extensions', 'man-kolwezi', 'MAN Kolwezi', '', '', '[]', 20, false),

-- DONS
('dons', 'transfert-bancaire', 'Transfert bancaire', '', '',
'[{"label": "Banque", "value": ""}, {"label": "Intitulé du compte", "value": ""}, {"label": "Numéro de compte", "value": ""}]', 10, false),
('dons', 'mobile-money', 'Mobile Money', '', '',
'[{"label": "M-Pesa", "value": ""}, {"label": "Orange Money", "value": ""}, {"label": "Airtel Money", "value": ""}]', 20, false);
