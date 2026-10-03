-- Référentiel V1 des centres d'intérêt PITIKORANA.
-- Intérêts personnels, loisirs, passions et pratiques ; aucune donnée personne_centre_interet.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM langue WHERE code = 'fr') THEN
    RAISE EXCEPTION 'Langue requise absente : fr';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM langue WHERE code = 'mg') THEN
    RAISE EXCEPTION 'Langue requise absente : mg';
  END IF;
END
$$;

-- Source temporaire : les contrôles ci-dessous ne concernent que ce seed.
CREATE TEMP TABLE pitikorana_seed_centres_interet (
  id uuid PRIMARY KEY,
  libelle_fr text NOT NULL,
  libelle_mg text NOT NULL
) ON COMMIT DROP;

INSERT INTO pitikorana_seed_centres_interet (id, libelle_fr, libelle_mg) VALUES
  ('15000000-0000-4000-8000-000000000001'::uuid, 'Football', 'Football'),
  ('15000000-0000-4000-8000-000000000002'::uuid, 'Futsal', 'Futsal'),
  ('15000000-0000-4000-8000-000000000003'::uuid, 'Basketball', 'Basketball'),
  ('15000000-0000-4000-8000-000000000004'::uuid, 'Volleyball', 'Volleyball'),
  ('15000000-0000-4000-8000-000000000005'::uuid, 'Handball', 'Handball'),
  ('15000000-0000-4000-8000-000000000006'::uuid, 'Rugby', 'Rugby'),
  ('15000000-0000-4000-8000-000000000007'::uuid, 'Baseball', 'Baseball'),
  ('15000000-0000-4000-8000-000000000008'::uuid, 'Cricket', 'Cricket'),
  ('15000000-0000-4000-8000-000000000009'::uuid, 'Beach-volley', 'Beach-volley'),
  ('15000000-0000-4000-8000-000000000010'::uuid, 'Jeux de plein air', 'Lalao an-kalamanjana'),
  ('15000000-0000-4000-8000-000000000011'::uuid, 'Tennis', 'Tennis'),
  ('15000000-0000-4000-8000-000000000012'::uuid, 'Tennis de table', 'Tenisy ambony latabatra'),
  ('15000000-0000-4000-8000-000000000013'::uuid, 'Badminton', 'Badminton'),
  ('15000000-0000-4000-8000-000000000014'::uuid, 'Natation', 'Lomano'),
  ('15000000-0000-4000-8000-000000000015'::uuid, 'Athlétisme', 'Atletisma'),
  ('15000000-0000-4000-8000-000000000016'::uuid, 'Course à pied', 'Hazakazaka'),
  ('15000000-0000-4000-8000-000000000017'::uuid, 'Randonnée', 'Fitsangatsanganana an-tongotra'),
  ('15000000-0000-4000-8000-000000000018'::uuid, 'Cyclisme', 'Bisikileta'),
  ('15000000-0000-4000-8000-000000000019'::uuid, 'VTT', 'Bisikileta an-tendrombohitra'),
  ('15000000-0000-4000-8000-000000000020'::uuid, 'Escalade', 'Fiakarana vatolampy'),
  ('15000000-0000-4000-8000-000000000021'::uuid, 'Fitness', 'Fitness'),
  ('15000000-0000-4000-8000-000000000022'::uuid, 'Musculation', 'Fananganana hozatra'),
  ('15000000-0000-4000-8000-000000000023'::uuid, 'Gymnastique', 'Gymnastique'),
  ('15000000-0000-4000-8000-000000000024'::uuid, 'Yoga', 'Yoga'),
  ('15000000-0000-4000-8000-000000000025'::uuid, 'Danse sportive', 'Dihy ara-panatanjahantena'),
  ('15000000-0000-4000-8000-000000000026'::uuid, 'Arts martiaux', 'Haiady'),
  ('15000000-0000-4000-8000-000000000027'::uuid, 'Boxe', 'Boxe'),
  ('15000000-0000-4000-8000-000000000028'::uuid, 'Judo', 'Judo'),
  ('15000000-0000-4000-8000-000000000029'::uuid, 'Karaté', 'Karaté'),
  ('15000000-0000-4000-8000-000000000030'::uuid, 'MMA', 'MMA'),
  ('15000000-0000-4000-8000-000000000031'::uuid, 'Sports automobiles', 'Fanatanjahantena fiara'),
  ('15000000-0000-4000-8000-000000000032'::uuid, 'Moto', 'Moto'),
  ('15000000-0000-4000-8000-000000000033'::uuid, 'Véhicules anciens', 'Fiara tranainy'),
  ('15000000-0000-4000-8000-000000000034'::uuid, 'Karting', 'Karting'),
  ('15000000-0000-4000-8000-000000000035'::uuid, 'Aviation', 'Aviation'),
  ('15000000-0000-4000-8000-000000000036'::uuid, 'Sports nautiques', 'Fanatanjahantena anaty rano'),
  ('15000000-0000-4000-8000-000000000037'::uuid, 'Voile', 'Sambo lay'),
  ('15000000-0000-4000-8000-000000000038'::uuid, 'Canoë-kayak', 'Lakana sy kayak'),
  ('15000000-0000-4000-8000-000000000039'::uuid, 'Surf', 'Surf'),
  ('15000000-0000-4000-8000-000000000040'::uuid, 'Plongée sous-marine', 'Fitsorohana anaty rano'),
  ('15000000-0000-4000-8000-000000000041'::uuid, 'Musique', 'Mozika'),
  ('15000000-0000-4000-8000-000000000042'::uuid, 'Écoute musicale', 'Fihainoana mozika'),
  ('15000000-0000-4000-8000-000000000043'::uuid, 'Chant', 'Fihirana'),
  ('15000000-0000-4000-8000-000000000044'::uuid, 'Chorale', 'Antoko mpihira'),
  ('15000000-0000-4000-8000-000000000045'::uuid, 'Guitare', 'Gitara'),
  ('15000000-0000-4000-8000-000000000046'::uuid, 'Piano', 'Piano'),
  ('15000000-0000-4000-8000-000000000047'::uuid, 'Batterie', 'Amponga'),
  ('15000000-0000-4000-8000-000000000048'::uuid, 'Instruments traditionnels malagasy', 'Zavamaneno nentin-drazana malagasy'),
  ('15000000-0000-4000-8000-000000000049'::uuid, 'Composition musicale', 'Famoronana mozika'),
  ('15000000-0000-4000-8000-000000000050'::uuid, 'Danse malagasy', 'Dihy malagasy'),
  ('15000000-0000-4000-8000-000000000051'::uuid, 'Dessin', 'Fanaovana sary'),
  ('15000000-0000-4000-8000-000000000052'::uuid, 'Peinture', 'Hosodoko'),
  ('15000000-0000-4000-8000-000000000053'::uuid, 'Sculpture', 'Sokitra'),
  ('15000000-0000-4000-8000-000000000054'::uuid, 'Photographie', 'Fakana sary'),
  ('15000000-0000-4000-8000-000000000055'::uuid, 'Photographie de nature', 'Fakana sary zavaboary'),
  ('15000000-0000-4000-8000-000000000056'::uuid, 'Vidéo', 'Horonantsary'),
  ('15000000-0000-4000-8000-000000000057'::uuid, 'Cinéma', 'Sarimihetsika'),
  ('15000000-0000-4000-8000-000000000058'::uuid, 'Théâtre', 'Teatra'),
  ('15000000-0000-4000-8000-000000000059'::uuid, 'Écriture créative', 'Fanoratana famoronana'),
  ('15000000-0000-4000-8000-000000000060'::uuid, 'Poésie', 'Tononkalo'),
  ('15000000-0000-4000-8000-000000000061'::uuid, 'Artisanat', 'Asa tanana'),
  ('15000000-0000-4000-8000-000000000062'::uuid, 'Artisanat malagasy', 'Asa tanana malagasy'),
  ('15000000-0000-4000-8000-000000000063'::uuid, 'Couture créative', 'Fanjairana famoronana'),
  ('15000000-0000-4000-8000-000000000064'::uuid, 'Broderie', 'Peta-kofehy'),
  ('15000000-0000-4000-8000-000000000065'::uuid, 'Tissage', 'Fanenomana'),
  ('15000000-0000-4000-8000-000000000066'::uuid, 'Décoration', 'Haingo'),
  ('15000000-0000-4000-8000-000000000067'::uuid, 'Décoration intérieure', 'Haingo an-trano'),
  ('15000000-0000-4000-8000-000000000068'::uuid, 'Design', 'Design'),
  ('15000000-0000-4000-8000-000000000069'::uuid, 'Bricolage', 'Asa tanana an-trano'),
  ('15000000-0000-4000-8000-000000000070'::uuid, 'DIY', 'DIY'),
  ('15000000-0000-4000-8000-000000000071'::uuid, 'Lecture', 'Famakiana boky'),
  ('15000000-0000-4000-8000-000000000072'::uuid, 'Littérature', 'Haisoratra'),
  ('15000000-0000-4000-8000-000000000073'::uuid, 'Bandes dessinées', 'Boky tantara an-tsary'),
  ('15000000-0000-4000-8000-000000000074'::uuid, 'Histoire', 'Tantara'),
  ('15000000-0000-4000-8000-000000000075'::uuid, 'Histoire de Madagascar', 'Tantaran''i Madagasikara'),
  ('15000000-0000-4000-8000-000000000076'::uuid, 'Patrimoine malagasy', 'Lova malagasy'),
  ('15000000-0000-4000-8000-000000000077'::uuid, 'Cultures du monde', 'Kolontsaina maneran-tany'),
  ('15000000-0000-4000-8000-000000000078'::uuid, 'Musées', 'Tranombakoka'),
  ('15000000-0000-4000-8000-000000000079'::uuid, 'Actualité culturelle', 'Vaovao ara-kolontsaina'),
  ('15000000-0000-4000-8000-000000000080'::uuid, 'Langues et cultures', 'Fiteny sy kolontsaina'),
  ('15000000-0000-4000-8000-000000000081'::uuid, 'Informatique', 'Informatika'),
  ('15000000-0000-4000-8000-000000000082'::uuid, 'Nouvelles technologies', 'Teknolojia vaovao'),
  ('15000000-0000-4000-8000-000000000083'::uuid, 'Programmation', 'Fandaharana informatika'),
  ('15000000-0000-4000-8000-000000000084'::uuid, 'Intelligence artificielle', 'Faharanitan-tsaina artifisialy'),
  ('15000000-0000-4000-8000-000000000085'::uuid, 'Robotique', 'Robotika'),
  ('15000000-0000-4000-8000-000000000086'::uuid, 'Électronique', 'Elektronika'),
  ('15000000-0000-4000-8000-000000000087'::uuid, 'Jeux vidéo', 'Jeux vidéo'),
  ('15000000-0000-4000-8000-000000000088'::uuid, 'Création numérique', 'Famoronana nomerika'),
  ('15000000-0000-4000-8000-000000000089'::uuid, 'Cybersécurité', 'Cybersécurité'),
  ('15000000-0000-4000-8000-000000000090'::uuid, 'Impression 3D', 'Fanontana 3D'),
  ('15000000-0000-4000-8000-000000000091'::uuid, 'Nature', 'Zavaboary'),
  ('15000000-0000-4000-8000-000000000092'::uuid, 'Environnement', 'Tontolo iainana'),
  ('15000000-0000-4000-8000-000000000093'::uuid, 'Jardinage', 'Fikarakarana zaridaina'),
  ('15000000-0000-4000-8000-000000000094'::uuid, 'Agriculture', 'Fambolena'),
  ('15000000-0000-4000-8000-000000000095'::uuid, 'Animaux', 'Biby'),
  ('15000000-0000-4000-8000-000000000096'::uuid, 'Animaux domestiques', 'Biby fiompy an-trano'),
  ('15000000-0000-4000-8000-000000000097'::uuid, 'Protection animale', 'Fiarovana biby'),
  ('15000000-0000-4000-8000-000000000098'::uuid, 'Biodiversité', 'Fahasamihafan''ny zava-manan''aina'),
  ('15000000-0000-4000-8000-000000000099'::uuid, 'Reboisement', 'Famerenana ala'),
  ('15000000-0000-4000-8000-000000000100'::uuid, 'Observation des oiseaux', 'Fijerena vorona'),
  ('15000000-0000-4000-8000-000000000101'::uuid, 'Voyages', 'Dia lavitra'),
  ('15000000-0000-4000-8000-000000000102'::uuid, 'Tourisme', 'Fizahan-tany'),
  ('15000000-0000-4000-8000-000000000103'::uuid, 'Découverte de Madagascar', 'Fahitana an''i Madagasikara'),
  ('15000000-0000-4000-8000-000000000104'::uuid, 'Découverte culturelle', 'Fahitana kolontsaina'),
  ('15000000-0000-4000-8000-000000000105'::uuid, 'Excursions', 'Fitsangatsanganana'),
  ('15000000-0000-4000-8000-000000000106'::uuid, 'Camping', 'Lasy an-kalamanjana'),
  ('15000000-0000-4000-8000-000000000107'::uuid, 'Aventure', 'Fitsangatsanganana mampientanentana'),
  ('15000000-0000-4000-8000-000000000108'::uuid, 'Géographie', 'Jeografia'),
  ('15000000-0000-4000-8000-000000000109'::uuid, 'Passion pour les cartes', 'Fitiavana sarintany'),
  ('15000000-0000-4000-8000-000000000110'::uuid, 'Découverte culinaire', 'Fahitana sakafo samihafa'),
  ('15000000-0000-4000-8000-000000000111'::uuid, 'Cuisine', 'Fandrahoan-tsakafo'),
  ('15000000-0000-4000-8000-000000000112'::uuid, 'Cuisine malagasy', 'Sakafo malagasy'),
  ('15000000-0000-4000-8000-000000000113'::uuid, 'Cuisine du monde', 'Sakafo maneran-tany'),
  ('15000000-0000-4000-8000-000000000114'::uuid, 'Pâtisserie', 'Patisserie'),
  ('15000000-0000-4000-8000-000000000115'::uuid, 'Boulangerie', 'Fanaovana mofo'),
  ('15000000-0000-4000-8000-000000000116'::uuid, 'Barbecue', 'Barbecue'),
  ('15000000-0000-4000-8000-000000000117'::uuid, 'Recettes de cuisine', 'Fomba fahandro'),
  ('15000000-0000-4000-8000-000000000118'::uuid, 'Décoration de gâteaux', 'Haingo mofomamy'),
  ('15000000-0000-4000-8000-000000000119'::uuid, 'Confiture maison', 'Fanaovana jamo'),
  ('15000000-0000-4000-8000-000000000120'::uuid, 'Cuisine végétarienne', 'Sakafo tsy misy hena'),
  ('15000000-0000-4000-8000-000000000121'::uuid, 'Bénévolat', 'Asa an-tsitrapo'),
  ('15000000-0000-4000-8000-000000000122'::uuid, 'Vie associative', 'Fiainana anaty fikambanana'),
  ('15000000-0000-4000-8000-000000000123'::uuid, 'Actions communautaires', 'Asa iombonana'),
  ('15000000-0000-4000-8000-000000000124'::uuid, 'Entraide', 'Fifanampiana'),
  ('15000000-0000-4000-8000-000000000125'::uuid, 'Œuvres sociales', 'Asa sosialy'),
  ('15000000-0000-4000-8000-000000000126'::uuid, 'Événements communautaires', 'Lanonana iombonana'),
  ('15000000-0000-4000-8000-000000000127'::uuid, 'Activités de jeunesse', 'Hetsiky ny tanora'),
  ('15000000-0000-4000-8000-000000000128'::uuid, 'Activités familiales', 'Hetsika ara-pianakaviana'),
  ('15000000-0000-4000-8000-000000000129'::uuid, 'Solidarité', 'Firaisankina'),
  ('15000000-0000-4000-8000-000000000130'::uuid, 'Développement communautaire', 'Fampandrosoana fiarahamonina'),
  ('15000000-0000-4000-8000-000000000131'::uuid, 'Étude biblique', 'Fandalinana Baiboly'),
  ('15000000-0000-4000-8000-000000000132'::uuid, 'Lecture de la Bible', 'Famakiana Baiboly'),
  ('15000000-0000-4000-8000-000000000133'::uuid, 'Chant religieux', 'Hira fiderana'),
  ('15000000-0000-4000-8000-000000000134'::uuid, 'Chorale d''Église', 'Antoko mpihira ao am-piangonana'),
  ('15000000-0000-4000-8000-000000000135'::uuid, 'Musique chrétienne', 'Mozika kristianina'),
  ('15000000-0000-4000-8000-000000000136'::uuid, 'Activités de jeunesse chrétienne', 'Hetsiky ny tanora kristianina'),
  ('15000000-0000-4000-8000-000000000137'::uuid, 'Actions sociales de l''Église', 'Asa sosialin''ny Fiangonana'),
  ('15000000-0000-4000-8000-000000000138'::uuid, 'Missions et évangélisation', 'Misiona sy fitoriana ny Filazantsara'),
  ('15000000-0000-4000-8000-000000000139'::uuid, 'Vie communautaire chrétienne', 'Fiainana iombonan''ny kristianina'),
  ('15000000-0000-4000-8000-000000000140'::uuid, 'Histoire de l''Église', 'Tantaran''ny Fiangonana'),
  ('15000000-0000-4000-8000-000000000141'::uuid, 'Vie familiale', 'Fiainam-pianakaviana'),
  ('15000000-0000-4000-8000-000000000142'::uuid, 'Éducation des enfants', 'Fanabeazana ankizy'),
  ('15000000-0000-4000-8000-000000000143'::uuid, 'Jeux avec les enfants', 'Lalao miaraka amin''ny ankizy'),
  ('15000000-0000-4000-8000-000000000144'::uuid, 'Cuisine familiale', 'Sakafo an-trano'),
  ('15000000-0000-4000-8000-000000000145'::uuid, 'Entretien du jardin', 'Fikojakojana zaridaina'),
  ('15000000-0000-4000-8000-000000000146'::uuid, 'Aménagement de la maison', 'Fanamboarana trano'),
  ('15000000-0000-4000-8000-000000000147'::uuid, 'Organisation de la maison', 'Fandaminana tokantrano'),
  ('15000000-0000-4000-8000-000000000148'::uuid, 'Plantes d''intérieur', 'Zavamaniry an-trano'),
  ('15000000-0000-4000-8000-000000000149'::uuid, 'Soins aux animaux domestiques', 'Fikarakarana biby an-trano'),
  ('15000000-0000-4000-8000-000000000150'::uuid, 'Collection d''objets', 'Fanangonana zavatra'),
  ('15000000-0000-4000-8000-000000000151'::uuid, 'Développement personnel', 'Fampandrosoana ny tena'),
  ('15000000-0000-4000-8000-000000000152'::uuid, 'Apprentissage continu', 'Fianarana mitohy'),
  ('15000000-0000-4000-8000-000000000153'::uuid, 'Entrepreneuriat', 'Fandraharahana'),
  ('15000000-0000-4000-8000-000000000154'::uuid, 'Leadership', 'Fitarihana'),
  ('15000000-0000-4000-8000-000000000155'::uuid, 'Prise de parole en public', 'Fitenenana imasom-bahoaka'),
  ('15000000-0000-4000-8000-000000000156'::uuid, 'Productivité personnelle', 'Fahombiazan''ny tena'),
  ('15000000-0000-4000-8000-000000000157'::uuid, 'Éducation financière', 'Fanabeazana ara-bola'),
  ('15000000-0000-4000-8000-000000000158'::uuid, 'Gestion du temps', 'Fitantanana fotoana'),
  ('15000000-0000-4000-8000-000000000159'::uuid, 'Lecture de développement personnel', 'Famakiana boky fampandrosoana tena'),
  ('15000000-0000-4000-8000-000000000160'::uuid, 'Mentorat', 'Fanoroana lalana'),
  ('15000000-0000-4000-8000-000000000161'::uuid, 'Jeux de société', 'Lalao an-databatra'),
  ('15000000-0000-4000-8000-000000000162'::uuid, 'Échecs', 'Échecs'),
  ('15000000-0000-4000-8000-000000000163'::uuid, 'Jeux de cartes', 'Lalao karatra'),
  ('15000000-0000-4000-8000-000000000164'::uuid, 'Quiz', 'Quiz'),
  ('15000000-0000-4000-8000-000000000165'::uuid, 'Puzzles', 'Puzzles'),
  ('15000000-0000-4000-8000-000000000166'::uuid, 'Karaoké', 'Karaoké'),
  ('15000000-0000-4000-8000-000000000167'::uuid, 'Humour', 'Hatsikana'),
  ('15000000-0000-4000-8000-000000000168'::uuid, 'Spectacles', 'Seho'),
  ('15000000-0000-4000-8000-000000000169'::uuid, 'Séries télévisées', 'Tantara mitohy amin''ny fahitalavitra'),
  ('15000000-0000-4000-8000-000000000170'::uuid, 'Jeux de rôle', 'Jeux de rôle');

INSERT INTO centre_interet (id)
SELECT id FROM pitikorana_seed_centres_interet
ON CONFLICT (id) DO NOTHING;

WITH langues AS (
  SELECT code, id FROM langue WHERE code IN ('fr', 'mg')
), traductions AS (
  SELECT source.id AS id_centre_interet, langue.id AS id_langue,
    CASE langue.code WHEN 'fr' THEN source.libelle_fr ELSE source.libelle_mg END AS libelle
  FROM pitikorana_seed_centres_interet source
  CROSS JOIN langues langue
)
INSERT INTO centre_interet_traduction (id_centre_interet, id_langue, libelle)
SELECT id_centre_interet, id_langue, libelle FROM traductions
ON CONFLICT (id_centre_interet, id_langue) DO UPDATE SET libelle = EXCLUDED.libelle;

-- Contrôles limités aux centres appartenant exactement à ce seed.
SELECT count(*) AS centres_seed FROM pitikorana_seed_centres_interet;
SELECT langue.code, count(*) AS traductions_seed
FROM centre_interet_traduction traduction
JOIN pitikorana_seed_centres_interet source ON source.id = traduction.id_centre_interet
JOIN langue ON langue.id = traduction.id_langue
WHERE langue.code IN ('fr', 'mg')
GROUP BY langue.code ORDER BY langue.code;
SELECT source.id AS centre_sans_fr_ou_mg
FROM pitikorana_seed_centres_interet source
CROSS JOIN (SELECT id FROM langue WHERE code IN ('fr', 'mg')) langue
LEFT JOIN centre_interet_traduction traduction
  ON traduction.id_centre_interet = source.id AND traduction.id_langue = langue.id
WHERE traduction.id_centre_interet IS NULL;
SELECT traduction.libelle AS libelle_fr_duplique, count(*)
FROM centre_interet_traduction traduction
JOIN pitikorana_seed_centres_interet source ON source.id = traduction.id_centre_interet
JOIN langue ON langue.id = traduction.id_langue
WHERE langue.code = 'fr'
GROUP BY traduction.libelle HAVING count(*) > 1;
SELECT traduction.libelle AS libelle_mg_duplique, count(*)
FROM centre_interet_traduction traduction
JOIN pitikorana_seed_centres_interet source ON source.id = traduction.id_centre_interet
JOIN langue ON langue.id = traduction.id_langue
WHERE langue.code = 'mg'
GROUP BY traduction.libelle HAVING count(*) > 1;
SELECT id AS uuid_source_duplique, count(*)
FROM pitikorana_seed_centres_interet
GROUP BY id HAVING count(*) > 1;
SELECT traduction.id_centre_interet AS traduction_orpheline
FROM centre_interet_traduction traduction
JOIN pitikorana_seed_centres_interet source ON source.id = traduction.id_centre_interet
LEFT JOIN centre_interet centre ON centre.id = traduction.id_centre_interet
WHERE centre.id IS NULL;

COMMIT;

