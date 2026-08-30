/* ------------------------------------------------------------------
   Always Trees — สลับภาษาไทย / อังกฤษ / จีน

   วิธีทำงาน: ไม่ได้แก้โครงหน้าเว็บเลย แต่เดินไล่ text node ทั้งหน้า
   แล้วเทียบกับพจนานุกรมที่คีย์ด้วย "ข้อความไทยต้นฉบับ"
   ข้อความไหนไม่มีคำแปล จะคงภาษาไทยไว้ตามเดิม ไม่หายไป

   เนื้อหาบางส่วน (ขั้นตอนการทำงาน 6 ขั้น และแคปชันสไลด์) ถูกสร้างด้วย
   จาวาสคริปต์หลังหน้าโหลด จึงมี MutationObserver คอยแปลของที่เพิ่มมาทีหลังด้วย
-------------------------------------------------------------------*/
(function () {
  "use strict";

  var LANGS = [
    { k: "th", label: "ไทย", html: "th" },
    { k: "en", label: "EN", html: "en" },
    { k: "zh", label: "中文", html: "zh-Hans" }
  ];

  var EN = {
    /* ---- หัวเรื่องและเมนู ---- */
    "Always Trees | รับออกแบบและจัดสวน กรุงเทพฯ และปริมณฑล": "Always Trees | Garden Design & Landscaping, Bangkok & Vicinity",
    "ตัวตนของเรา": "Who We Are",
    "บริการ": "Services",
    "จัดสวน": "Garden Design",
    "อื่น ๆ": "Other Services",
    "ลดภาษีที่ดิน": "Land Tax Reduction",
    "ขั้นตอน": "Process",
    "ผลงาน": "Our Work",
    "คำถาม": "FAQ",
    "ลองจัดสวนเอง": "Design It Yourself",
    "ปรึกษาฟรี": "Free Consultation",
    "เมนู": "Menu",
    "หน้าแรก": "Home",
    "ขั้นตอนการทำงาน": "How We Work",
    "คำถามที่พบบ่อย": "Frequently Asked Questions",
    "ดูบริการ": "See Services",
    "ติดต่อ": "Contact",
    "อีเมล": "Email",

    /* ---- ปกและปณิธาน ---- */
    "สวนหน้าบ้าน บ้านเดี่ยว · จัดใหม่ทั้งแปลง": "Front garden, detached house · replanted throughout",
    "สวนใต้ต้นไม้ใหญ่ · ปรับปรุงจากของเดิม": "Garden under mature trees · renovated in place",
    "สวนแนวตั้ง · บูธอีเว้นต์": "Vertical garden · event booth",
    "ปณิธานของเรา": "Our Promise",
    "สวนที่ดี ต้องอยู่กับบ้านได้นาน": "A good garden lives with the house for years",
    // มีช่องว่างท้ายโดยตั้งใจ เพราะในต้นฉบับคำนี้ติดกับแท็ก <em> พอดี
    // ภาษาไทยไม่ต้องเว้นวรรค แต่ภาษาอังกฤษต้อง
    "โดย": "without ",
    "ไม่กลายเป็นภาระ": "becoming a burden",
    "รอภาพจริง": "Photo coming",
    "เราทำสวนที่ยิ่งเวลาผ่านไปยิ่งสวย ไม่ใช่สวยแค่วันส่งมอบ":
      "We build gardens that get better with time, not gardens that only look good on handover day.",

    /* ---- ตัวตนของเรา ---- */
    "สวนที่ดีไม่ได้เริ่มจากต้นไม้": "A good garden doesn't start with plants",
    "แต่เริ่มจาก": "it starts with",
    "คนที่จะอยู่กับมัน": "the people who will live with it",
    "เราไม่ได้ถามแค่ว่าคุณชอบต้นไม้อะไร แต่ถามว่าคุณใช้ชีวิตยังไง ใครอยู่บ้านบ้าง นั่งตรงไหน มีเวลาดูแลแค่ไหน แล้วค่อยออกแบบจากคำตอบนั้น":
      "We don't only ask which plants you like. We ask how you live, who else is at home, where you sit, and how much time you have to look after it — then we design from those answers.",
    "ดูแลเหมือนเป็นบ้านตัวเอง": "Cared for like our own home",
    "สวนคือพื้นที่ของทุกคนในบ้าน เราจึงคิดถึงเด็ก ผู้สูงอายุ และสัตว์เลี้ยง ตั้งแต่ตอนเลือกต้นไม้ ไม่ใช่แค่ตอนจัดวางให้สวย":
      "A garden belongs to everyone in the house, so we think about children, older family members and pets from the moment we choose the plants — not only when arranging them to look good.",
    "สวนที่เป็นตัวคุณ ไม่ใช่ตัวเรา": "Your garden, not ours",
    "แบบที่ดีคือแบบที่สะท้อนไลฟ์สไตล์จริงของเจ้าของบ้าน เราเป็นทั้งคนออกแบบและคนลงมือทำเอง จึงรู้ว่าอะไรทำได้จริงในงบและพื้นที่ที่มี":
      "A good design reflects how the owner actually lives. We both design and carry out the work ourselves, so we know what can really be done within your budget and your space.",
    "งดงามขึ้นตามเวลา": "More beautiful with time",
    "เราออกแบบจากขนาดต้นไม้ในปีที่สิบ ไม่ใช่วันส่งมอบ บอกข้อเสียและค่าดูแลให้ครบก่อนตัดสินใจ แล้วอยู่ดูแลต่อจนต้นตั้งตัว":
      "We design around how big a tree will be in its tenth year, not on handover day. We tell you the drawbacks and the upkeep costs before you decide, then stay to look after it until the plants take hold.",
    "เราทำงานตรงไปตรงมา": "We work straight with you",
    "ไม่ขายฝัน": "no dreams for sale",
    "ถ้าต้นไม้ที่คุณอยากได้จะสร้างปัญหากับบ้านในอีกห้าปี เราจะบอกตั้งแต่วันแรก แล้วหาทางเลือกที่ให้ความรู้สึกเดียวกันแต่อยู่ด้วยกันได้นานกว่า":
      "If the tree you want will cause trouble for the house five years from now, we will say so on day one — then find an alternative that gives the same feeling and lives with you far longer.",

    /* ---- บริการ ---- */
    "การออกแบบและจัดสวน": "Design & Landscaping",
    "บริการด้านจัดสวน ดูแลตัดแต่ง และบำรุงรักษาพื้นที่กลางแจ้ง เป็นมิตรกับสิ่งแวดล้อม ปลอดภัยต่อคุณและครอบครัว":
      "Garden design, pruning and outdoor maintenance — kind to the environment and safe for you and your family.",
    "ออกแบบและลงมือทำเองทั้งกระบวนการ ตั้งแต่อ่านพื้นที่ ทิศแดด ทิศลม ไปจนถึงวันส่งมอบ":
      "We design and carry out the whole process ourselves, from reading the site, the sun and the wind, through to handover day.",
    "จัดสวนบ้านพักอาศัย พื้นที่ส่วนตัว": "Homes and private spaces",
    "บ้านเดี่ยว ทาวน์โฮม และพื้นที่ส่วนตัว วางผังจากทิศแดด ทิศลม ระยะจากตัวอาคาร และแนวท่อใต้ดิน ก่อนเลือกชนิดต้นไม้":
      "Detached houses, townhomes and private spaces. We plan from sun and wind direction, distance from the building and underground pipe runs before choosing a single plant.",
    "จัดสวนโครงการที่พักอาศัย": "Residential developments",
    "หมู่บ้านจัดสรร คอนโด และพื้นที่ส่วนกลาง งานสเกลใหญ่ที่ต้องคุมทั้งงบ ระยะเวลา และแผนดูแลระยะยาว":
      "Housing estates, condominiums and common areas — large-scale work where budget, schedule and a long-term care plan all have to be held together.",
    "ปรับปรุงสวนเดิมและฟื้นฟู": "Renovating an existing garden",
    "สวนที่รกหรือต้นไม้โตเกินขนาด เราประเมินว่าต้นไหนควรเก็บ ต้นไหนควรย้าย ต้นไหนควรตัดออก แล้ววางผังใหม่บนของเดิม":
      "For overgrown gardens or trees that have outgrown their space, we assess which to keep, which to move and which to remove, then lay out a new plan on what is already there.",
    "งานที่ทำให้สวนอยู่ได้จริงในระยะยาว และงานเฉพาะกิจที่ต้องใช้ทีมที่ชำนาญหน้างาน":
      "The work that keeps a garden alive for the long run, plus one-off jobs that need a team experienced on site.",
    "ดูแลสวนรายเดือน": "Monthly garden care",
    "เข้าดูแลตามรอบ ตัดหญ้า พรวนดิน ใส่ปุ๋ย ดูแลระบบน้ำ เฝ้าระวังโรคและแมลง พร้อมรายงานสภาพต้นไม้ให้ทุกครั้ง":
      "Scheduled visits for mowing, turning the soil, fertilising, checking irrigation and watching for pests and disease — with a plant condition report every time.",
    "ตัดแต่งต้นไม้ใหญ่": "Large tree pruning",
    "จัดทรงพุ่ม ลดความเสี่ยงกิ่งหักก่อนหน้าฝน เปิดทรงให้ลมผ่าน และตัดกิ่งที่พาดสายไฟหรือคลุมหลังคา":
      "Shaping the canopy, reducing the risk of branch failure before the rains, opening the crown to let wind through, and cutting branches over power lines or roofs.",
    "สวนแนวตั้งและบูธอีเว้นต์": "Vertical gardens and event booths",
    "ผนังต้นไม้จริงสำหรับบูธแสดงสินค้า ร้านค้า และผนังในอาคาร ติดตั้งไว ถอดเก็บได้ พร้อมระบบน้ำและแผนดูแลตลอดงาน":
      "Living plant walls for exhibition booths, shops and interior walls. Quick to install, removable, with irrigation and a care plan for the whole event.",

    /* ---- ลดภาษีที่ดิน ---- */
    "เปลี่ยนที่รกร้างเป็นที่เกษตร ลดภาระภาษี และได้ที่ดินที่ยังใช้ประโยชน์ต่อได้":
      "Turn idle land into agricultural land — lower the tax burden and keep land you can still put to use.",
    "ที่ดินเปล่าเสียภาษีแพงกว่าที่ดินเพื่อการเกษตรหลายเท่า":
      "Vacant land is taxed several times higher than agricultural land",
    "ที่ดินเปล่าที่ปล่อยรกร้างเสียภาษีในอัตราสูงกว่าที่ดินเพื่อการเกษตรมาก เรารับปรับที่ดินให้เข้าเกณฑ์การใช้ประโยชน์ทางการเกษตร ตั้งแต่ปรับพื้นที่ เลือกชนิดพืช ปลูกตามอัตราที่กำหนด ไปจนถึงดูแลต่อเนื่อง":
      "Land left vacant is taxed at a far higher rate than agricultural land. We prepare land to meet the agricultural-use criteria — levelling the site, choosing suitable crops, planting at the required density, and caring for it afterwards.",
    "ประเมินที่ดินและเกณฑ์": "Assess the land and the criteria",
    "ดูขนาดแปลง สภาพพื้นที่ และชนิดพืชที่เหมาะ": "We look at plot size, site condition and which crops suit it.",
    "ปรับพื้นที่และปลูก": "Prepare the site and plant",
    "ถางปรับหน้าดิน วางแนวปลูก ลงต้นตามจำนวนต่อไร่":
      "Clearing and levelling the topsoil, setting out planting rows, planting to the required number per rai.",
    "ดูแลต่อเนื่อง": "Ongoing care",
    "ให้ต้นไม้อยู่รอดและที่ดินคงสภาพใช้ประโยชน์ตลอดปี":
      "Keeping the plants alive and the land in usable condition all year round.",
    "สอบถามที่ดินของคุณ": "Ask about your land",
    "รอภาพจริง 01": "Photo coming 01",
    "รอภาพจริง 02": "Photo coming 02",
    "รอภาพจริง 03": "Photo coming 03",
    "ที่ดินก่อนปรับ": "The land before preparation",
    "ภาพแปลงที่ยังรกร้าง ถ่ายให้เห็นทั้งแปลง": "The plot while still idle, photographed to show the whole area.",
    "ระหว่างปรับพื้นที่": "During site preparation",
    "ตอนถางและวางแนวปลูก": "While clearing and setting out the planting rows.",
    "หลังปลูกเสร็จ": "After planting",
    "แปลงที่ปลูกตามเกณฑ์เรียบร้อยแล้ว": "The plot planted to the required criteria.",
    "หมายเหตุ อัตราภาษีและเกณฑ์การใช้ประโยชน์ทางการเกษตรเป็นไปตามประกาศของทางราชการและอาจเปลี่ยนแปลงได้ เราช่วยดำเนินการด้านพื้นที่และการปลูก ส่วนการยื่นและการพิจารณาเป็นอำนาจของหน่วยงานท้องถิ่น":
      "Note: tax rates and the criteria for agricultural use follow official government announcements and may change. We handle the land and the planting; filing and approval rest with the local authority.",

    /* ---- ขั้นตอนการทำงาน ---- */
    "แตะที่ไอคอนเพื่อดูรายละเอียดแต่ละขั้น ทุกงานเดินตามหกขั้นตอนนี้เหมือนกัน คุณจะรู้ตลอดว่าตอนนี้อยู่ตรงไหน":
      "Tap an icon to see each step in detail. Every project follows these same six steps, so you always know where things stand.",
    "สอบถามความต้องการ": "Understand what you need",
    "คุยว่าอยากใช้สวนทำอะไร ชอบแนวไหน มีใครใช้พื้นที่บ้าง และตั้งงบไว้ประมาณเท่าไหร่ ขั้นนี้คุยทางโทรศัพท์หรือแชทก็ได้":
      "We talk about what you want to use the garden for, the style you like, who uses the space, and roughly what budget you have set. This step can be done by phone or chat.",
    "ตอนคุยงานกับลูกค้า": "Talking a job through with a client",
    "สำรวจพื้นที่และวัดระยะ": "Survey and measure the site",
    "เข้าไปดูหน้างานจริง วัดขนาด ดูทิศแดด ทิศลม สภาพดิน จุดที่น้ำขัง และแนวท่อกับสายไฟ ข้อมูลชุดนี้คือสิ่งที่ทำให้แบบใช้ได้จริง":
      "We visit the site, measure it, and check sun and wind direction, soil condition, where water pools, and the runs of pipes and cables. This is the information that makes a design workable.",
    "ค่าดำเนินการเริ่มต้น 2,000 บาท": "Starts at 2,000 baht",
    "ทีมงานกำลังวัดระยะหน้างาน": "The team measuring on site",
    "นำเสนอแบบ 3 มิติ": "Present the 3D design",
    "เห็นภาพสวนก่อนลงมือจริง ทั้งมุมมองและขนาดต้นไม้เมื่อโตเต็มที่ ปรับแบบได้จนกว่าคุณจะพอใจ":
      "You see the garden before any work begins — the views, and how big the plants will be when mature. We revise until you are happy.",
    "ภาพแบบ 3 มิติที่เคยเสนอลูกค้า": "A 3D design we presented to a client",
    "ทำใบเสนอราคา": "Issue the quotation",
    "แจกแจงทุกรายการ ค่าต้นไม้ ค่าวัสดุ และค่าแรง แยกให้เห็นทีละบรรทัด ไม่มีค่าใช้จ่ายที่โผล่มาทีหลัง":
      "Every item listed out — plants, materials and labour shown line by line. Nothing appears on the bill later.",
    "ตัวอย่างใบเสนอราคา": "A sample quotation",
    "ดำเนินการและส่งมอบ": "Build and hand over",
    "เตรียมดิน วางระบบน้ำ ขนส่งและปลูก ค้ำยันไม้ใหญ่ เก็บงานพื้นและขอบแปลง แล้วเก็บพื้นที่ให้เรียบร้อยก่อนส่งมอบ":
      "Soil preparation, irrigation, transport and planting, staking the large trees, finishing paving and bed edges, then clearing the site before handover.",
    "หน้างานตอนลงต้นไม้": "On site during planting",
    "ดูแลตามการรับประกัน": "Care under the warranty",
    "ช่วงตั้งตัวเป็นช่วงที่ต้นไม้ตายง่ายที่สุด เราตามดูแลจนต้นแข็งแรง และรับดูแลต่อเป็นรายเดือนถ้าคุณต้องการ":
      "The establishment period is when plants are most likely to die. We stay with it until they are strong, and can continue with monthly care if you want.",
    "สวนหลังส่งมอบไปแล้วหลายเดือน": "A garden several months after handover",

    /* ---- ผลงาน ---- */
    "งานที่ผ่านมา": "Past Work",
    "ภาพจากหน้างานจริง ชี้ที่ภาพเพื่อดูสภาพก่อนลงมือทำ":
      "Photographs from real sites. Point at an image to see the condition before we started.",
    "ก่อน": "Before",
    "หลัง": "After",
    "ชี้เพื่อดูก่อนทำ": "Point to see before",
    "สวนหน้าบ้าน บ้านเดี่ยว": "Front garden, detached house",
    "ปูหญ้าใหม่ทั้งแปลง วางทางเดินและแปลงไม้พุ่ม": "New turf across the whole plot, with a walkway and shrub beds.",
    "สวนใต้ต้นไม้ใหญ่": "Garden under mature trees",
    "เก็บต้นเดิมไว้ ตัดเถาวัลย์ จัดแปลงและมุมนั่งเล่นใหม่":
      "Existing trees kept, vines cleared, beds and a seating corner rearranged.",
    "สวนแนวตั้ง บูธอีเว้นต์": "Vertical garden, event booth",
    "ผนังต้นไม้จริงสำหรับงานแสดงสินค้า": "A living plant wall for a trade exhibition.",
    "ผลงาน 04": "Project 04",
    "ผลงาน 05": "Project 05",
    "ผลงาน 06": "Project 06",
    "สวนโครงการหรือพื้นที่ส่วนกลาง": "Development or common-area garden",
    "ระเบียงหรือดาดฟ้า": "Balcony or rooftop",
    "งานดูแลรายเดือน — ก่อนและหลังตัดแต่ง": "Monthly care — before and after pruning",
    "ภาพก่อนหน้า": "Previous image",
    "ภาพถัดไป": "Next image",
    "ไปที่ภาพที่": "Go to image ",

    /* ---- เครื่องมือ ---- */
    "เครื่องมือฟรี": "Free Tool",
    "ลองจัดสวนหน้ากำแพงด้วยตัวเองก่อนคุยกับเรา": "Try designing a wall garden yourself before you talk to us",
    "เลือกต้นไม้ วางเป็นชั้น ดูว่าโตเต็มที่แล้วจะบังได้แค่ไหน แล้วส่งแบบมาให้เราประเมินฟรี ไม่ต้องสมัคร ไม่ต้องเซฟ":
      "Pick plants, arrange them in layers, see how much they will screen once mature, then send us the design for a free assessment. No sign-up, nothing to save.",
    "เปิดเครื่องมือ": "Open the tool",
    "ให้เราออกแบบให้": "Let us design it",
    "ต้นไม้ 92 ชนิดที่ใช้จริงในงานกรุงเทพฯ": "92 species we actually use on Bangkok projects",
    "ดูได้ทั้งมุมมองด้านหน้าและผังจากด้านบน": "Front elevation and top-down plan view",
    "เตือนให้เมื่อปลูกชิดกำแพงเกินไปหรือทรงพุ่มจะชนกัน":
      "Warns you when a plant sits too close to the wall or canopies will collide",
    "ประเมินช่วงราคาค่าต้นไม้เบื้องต้นให้ทันที": "Gives a rough plant cost range straight away",

    /* ---- คำถามที่พบบ่อย ---- */
    "เรื่องที่ลูกค้าถามก่อนเสมอ": "What clients always ask first",
    "ถ้าคำถามของคุณไม่อยู่ในนี้ ทักมาถามได้เลย เราตอบให้ฟรีแม้จะยังไม่ได้จ้างงาน":
      "If your question isn't here, just message us. We answer for free even if you haven't hired us.",
    "ต้นไม้ควรปลูกห่างจากตัวบ้านเท่าไหร่": "How far from the house should trees be planted?",
    "ขึ้นกับระบบรากและทรงพุ่มของแต่ละชนิด ไม้รากแผ่ตื้นอย่างหูกระจงหรือหางนกยูงฝรั่งควรห่างจากตัวอาคารและพื้นปูอย่างน้อยห้าเมตร ส่วนไม้ที่รากไม่ทำลายโครงสร้างอย่างล่ำซำหรือแก้วปลูกใกล้กว่านั้นได้ หลักง่าย ๆ คือเผื่อระยะเท่ากับครึ่งหนึ่งของความกว้างทรงพุ่มเมื่อโตเต็มที่ แล้วบวกเพิ่มถ้าชนิดนั้นรากแรง":
      "It depends on the root system and canopy of each species. Shallow, spreading rooters such as hu krachong (Terminalia ivorensis) or royal poinciana (Delonix regia) should sit at least five metres from buildings and paving. Species whose roots don't damage structures, such as lamsam or orange jasmine (Murraya paniculata), can go closer. A simple rule: allow half the mature canopy width, then add more if the species is a strong rooter.",
    "ค่าออกแบบคิดอย่างไร": "How is the design fee calculated?",
    "ค่าดำเนินการสำรวจพื้นที่และวัดระยะเริ่มต้นที่ 2,000 บาท ซึ่งรวมการเข้าไปดูหน้างานจริงและเก็บข้อมูลพื้นที่ จากนั้นเรานำเสนอแบบ 3 มิติให้ดูก่อน ปรับแบบได้จนพอใจ แล้วจึงทำใบเสนอราคาที่แยกค่าต้นไม้ ค่าวัสดุ และค่าแรงให้เห็นชัดเจน":
      "A site survey and measurement starts at 2,000 baht, which covers visiting the site and gathering the information we need. We then present a 3D design for you to review and revise until you are happy, and only then issue a quotation that separates plant costs, material costs and labour clearly.",
    "ไม้มงคลที่รากทำลายบ้าน ควรปลูกไหม": "Should I plant auspicious trees whose roots damage buildings?",
    "ปลูกได้ แต่ต้องแยกสองเรื่องออกจากกัน ความเชื่อเป็นเรื่องหนึ่ง ความปลอดภัยของโครงสร้างเป็นอีกเรื่องหนึ่ง ต้นอย่างโพธิ์ ไทร และขนุน เป็นไม้มงคลตามความเชื่อไทยแต่รากไปไกลและแรงมาก ถ้าอยากได้ทั้งสองอย่าง เราจะเสนอให้ปลูกไว้ท้ายที่ดินห่างจากตัวบ้าน หรือปลูกลงกระถางใหญ่ที่คุมรากได้":
      "You can, but keep two things apart: belief is one matter, structural safety is another. Bodhi, banyan and jackfruit are auspicious in Thai belief, but their roots travel far and push hard. If you want both, we suggest planting them at the back of the plot away from the house, or in a large container that keeps the roots in check.",
    "สวนแบบไหนดูแลน้อยที่สุด": "Which kind of garden needs the least care?",
    "เลือกไม้ไม่ผลัดใบและใบร่วงน้อยเป็นโครงหลัก อย่างกันเกรา พิกุล หรืออโศกอินเดีย เลี่ยงไม้ผลและไม้ที่ดอกร่วงหนักถ้าอยู่ใกล้สระหรือทางเดิน ใช้ไม้คลุมดินแทนสนามหญ้าในจุดที่ตัดยาก และวางระบบน้ำอัตโนมัติตั้งแต่แรก":
      "Build the structure from evergreens that drop few leaves — tembusu (Fagraea fragrans), bullet wood (Mimusops elengi) or Indian mast tree (Polyalthia longifolia). Avoid fruit trees and heavy flower-droppers near a pool or walkway. Use ground cover instead of lawn where mowing is awkward, and put in automatic irrigation from the start.",
    "รับงานพื้นที่ไหนบ้าง": "Which areas do you cover?",
    "กรุงเทพฯ และปริมณฑลเป็นหลัก งานต่างจังหวัดพิจารณาเป็นรายงานตามขนาดและระยะทาง ทักมาสอบถามได้เลย":
      "Bangkok and the surrounding provinces mainly. Work further afield is considered case by case depending on size and distance — just ask.",

    /* ---- ติดต่อ ---- */
    "ปรึกษาฟรี ไม่มีค่าใช้จ่าย": "Free consultation, no charge",
    "ส่งรูปพื้นที่กับขนาดคร่าว ๆ มาก่อนก็ได้ เราประเมินเบื้องต้นให้ฟรี เลือกช่องทางที่คุณสะดวกได้เลย":
      "Send photos of the space and rough dimensions and we will give you an initial assessment free. Use whichever channel suits you.",
    "ส่งอะไรมาให้เราบ้าง": "What to send us",
    "ยิ่งครบ ยิ่งประเมินได้เร็วและแม่น": "The more complete, the faster and more accurate the estimate",
    "รูปพื้นที่ ถ่ายกว้าง ๆ สักสองสามมุม": "Photos of the space — wide shots from two or three angles",
    "ขนาดพื้นที่โดยประมาณ กว้างคูณยาว": "Approximate size, width by length",
    "แดดเข้าทางไหน ช่วงเช้าหรือช่วงบ่าย": "Which way the sun comes in, morning or afternoon",
    "เคยมีน้ำขังไหม ลึกแค่ไหน นานกี่วัน": "Has it ever held water — how deep, and for how many days",
    "มีเด็กเล็กหรือสัตว์เลี้ยงไหม": "Any small children or pets",
    "งบประมาณที่วางไว้คร่าว ๆ": "Roughly what budget you have in mind",

    /* ---- แอตทริบิวต์ ---- */
    "Always Trees รับออกแบบและจัดสวน ดูแลสวนรายเดือน ตัดแต่งต้นไม้ใหญ่ สวนแนวตั้ง และปรับที่รกร้างเป็นที่เกษตรเพื่อลดภาษีที่ดิน บริการกรุงเทพฯ และปริมณฑล ปรึกษาฟรี":
      "Always Trees — garden design and landscaping, monthly garden care, large tree pruning, vertical gardens, and converting idle land to agricultural use to reduce land tax. Serving Bangkok and the surrounding provinces. Free consultation.",
    "Always Trees หน้าแรก": "Always Trees home",
    "เปิดเมนู": "Open menu",
    "ปิดเมนู": "Close menu",
    "สวนหน้าบ้านบ้านเดี่ยวหลังจัดใหม่": "Front garden of a detached house after replanting",
    "สวนใต้ต้นไม้ใหญ่หลังปรับปรุง": "Garden under mature trees after renovation",
    "สวนแนวตั้งบนบูธอีเว้นต์": "Vertical garden on an event booth",
    "สวนหน้าบ้านหลังจัดใหม่": "Front garden after replanting",
    "สวนหน้าบ้านก่อนจัด": "Front garden before work",
    "สวนใต้ต้นไม้ใหญ่ก่อนปรับปรุง": "Garden under mature trees before renovation",
    "บริการของ Always Trees": "Always Trees services",
    "ลดภาษีที่ดิน เปลี่ยนที่รกร้างเป็นที่เกษตร": "Land tax reduction — converting idle land to agricultural use",
    "กรุงเทพมหานคร": "Bangkok",
    "ปริมณฑล": "Surrounding provinces"
  };

  var ZH = {
    "Always Trees | รับออกแบบและจัดสวน กรุงเทพฯ และปริมณฑล": "Always Trees｜曼谷及周边地区花园设计与施工",
    "ตัวตนของเรา": "关于我们",
    "บริการ": "服务项目",
    "จัดสวน": "花园设计",
    "อื่น ๆ": "其他服务",
    "ลดภาษีที่ดิน": "降低土地税",
    "ขั้นตอน": "服务流程",
    "ผลงาน": "案例作品",
    "คำถาม": "常见问题",
    "ลองจัดสวนเอง": "自己试着设计",
    "ปรึกษาฟรี": "免费咨询",
    "เมนู": "菜单",
    "หน้าแรก": "首页",
    "ขั้นตอนการทำงาน": "服务流程",
    "คำถามที่พบบ่อย": "常见问题",
    "ดูบริการ": "查看服务",
    "ติดต่อ": "联系我们",
    "อีเมล": "电子邮箱",

    "สวนหน้าบ้าน บ้านเดี่ยว · จัดใหม่ทั้งแปลง": "独栋别墅前庭 · 整片重新造园",
    "สวนใต้ต้นไม้ใหญ่ · ปรับปรุงจากของเดิม": "大树下的花园 · 原址改造",
    "สวนแนวตั้ง · บูธอีเว้นต์": "垂直绿墙 · 展会展位",
    "ปณิธานของเรา": "我们的承诺",
    "สวนที่ดี ต้องอยู่กับบ้านได้นาน": "好的花园，要能与房子长久共处",
    "โดย": "而",
    "ไม่กลายเป็นภาระ": "不成为负担",
    "รอภาพจริง": "实拍照片待补",
    "เราทำสวนที่ยิ่งเวลาผ่านไปยิ่งสวย ไม่ใช่สวยแค่วันส่งมอบ":
      "我们打造的花园会随时间越来越美，而不是只在交付当天好看。",

    "สวนที่ดีไม่ได้เริ่มจากต้นไม้": "好花园不是从植物开始的",
    "แต่เริ่มจาก": "而是始于",
    "คนที่จะอยู่กับมัน": "将与它共处的人",
    "เราไม่ได้ถามแค่ว่าคุณชอบต้นไม้อะไร แต่ถามว่าคุณใช้ชีวิตยังไง ใครอยู่บ้านบ้าง นั่งตรงไหน มีเวลาดูแลแค่ไหน แล้วค่อยออกแบบจากคำตอบนั้น":
      "我们不只问您喜欢什么植物，还会问您如何生活、家里有谁、常坐在哪、有多少时间打理，然后再依据这些答案来设计。",
    "ดูแลเหมือนเป็นบ้านตัวเอง": "像照顾自己家一样",
    "สวนคือพื้นที่ของทุกคนในบ้าน เราจึงคิดถึงเด็ก ผู้สูงอายุ และสัตว์เลี้ยง ตั้งแต่ตอนเลือกต้นไม้ ไม่ใช่แค่ตอนจัดวางให้สวย":
      "花园属于家中每一个人，所以从挑选植物那一刻起，我们就把小孩、长辈和宠物考虑进去，而不只是把它摆得好看。",
    "สวนที่เป็นตัวคุณ ไม่ใช่ตัวเรา": "是您的花园，不是我们的",
    "แบบที่ดีคือแบบที่สะท้อนไลฟ์สไตล์จริงของเจ้าของบ้าน เราเป็นทั้งคนออกแบบและคนลงมือทำเอง จึงรู้ว่าอะไรทำได้จริงในงบและพื้นที่ที่มี":
      "好的设计要反映屋主真实的生活方式。设计与施工都由我们自己完成，所以清楚在您的预算和场地条件下，什么才真正做得到。",
    "งดงามขึ้นตามเวลา": "随时间愈发美丽",
    "เราออกแบบจากขนาดต้นไม้ในปีที่สิบ ไม่ใช่วันส่งมอบ บอกข้อเสียและค่าดูแลให้ครบก่อนตัดสินใจ แล้วอยู่ดูแลต่อจนต้นตั้งตัว":
      "我们按第十年的树形来设计，而不是交付当天的样子。决定之前把缺点和养护成本讲清楚，之后持续照料到植株扎根成活。",
    "เราทำงานตรงไปตรงมา": "我们直说实话",
    "ไม่ขายฝัน": "不卖梦想",
    "ถ้าต้นไม้ที่คุณอยากได้จะสร้างปัญหากับบ้านในอีกห้าปี เราจะบอกตั้งแต่วันแรก แล้วหาทางเลือกที่ให้ความรู้สึกเดียวกันแต่อยู่ด้วยกันได้นานกว่า":
      "如果您想要的树在五年后会给房子带来麻烦，我们第一天就会告诉您，然后找出感觉相同、却能陪伴更久的替代方案。",

    "การออกแบบและจัดสวน": "设计与造园",
    "บริการด้านจัดสวน ดูแลตัดแต่ง และบำรุงรักษาพื้นที่กลางแจ้ง เป็นมิตรกับสิ่งแวดล้อม ปลอดภัยต่อคุณและครอบครัว":
      "花园设计、修剪与户外空间养护，对环境友善，对您和家人安全。",
    "ออกแบบและลงมือทำเองทั้งกระบวนการ ตั้งแต่อ่านพื้นที่ ทิศแดด ทิศลม ไปจนถึงวันส่งมอบ":
      "从解读场地、日照与风向，一直到交付当天，全程由我们自己设计并施工。",
    "จัดสวนบ้านพักอาศัย พื้นที่ส่วนตัว": "住宅与私人空间造园",
    "บ้านเดี่ยว ทาวน์โฮม และพื้นที่ส่วนตัว วางผังจากทิศแดด ทิศลม ระยะจากตัวอาคาร และแนวท่อใต้ดิน ก่อนเลือกชนิดต้นไม้":
      "独栋、联排与私人空间。我们先确认日照、风向、与建筑的距离和地下管线走向，再挑选植物品种。",
    "จัดสวนโครงการที่พักอาศัย": "住宅项目造园",
    "หมู่บ้านจัดสรร คอนโด และพื้นที่ส่วนกลาง งานสเกลใหญ่ที่ต้องคุมทั้งงบ ระยะเวลา และแผนดูแลระยะยาว":
      "别墅区、公寓与公共区域。大型项目需要同时把控预算、工期与长期养护计划。",
    "ปรับปรุงสวนเดิมและฟื้นฟู": "旧园改造与复原",
    "สวนที่รกหรือต้นไม้โตเกินขนาด เราประเมินว่าต้นไหนควรเก็บ ต้นไหนควรย้าย ต้นไหนควรตัดออก แล้ววางผังใหม่บนของเดิม":
      "对于荒废或长过头的花园，我们评估哪些保留、哪些移植、哪些移除，再在原有基础上重新规划。",
    "งานที่ทำให้สวนอยู่ได้จริงในระยะยาว และงานเฉพาะกิจที่ต้องใช้ทีมที่ชำนาญหน้างาน":
      "让花园长久存续的日常工作，以及需要现场经验的专项作业。",
    "ดูแลสวนรายเดือน": "每月花园养护",
    "เข้าดูแลตามรอบ ตัดหญ้า พรวนดิน ใส่ปุ๋ย ดูแลระบบน้ำ เฝ้าระวังโรคและแมลง พร้อมรายงานสภาพต้นไม้ให้ทุกครั้ง":
      "按周期上门修剪草坪、松土、施肥、检查灌溉系统、监控病虫害，每次都附上植物状况报告。",
    "ตัดแต่งต้นไม้ใหญ่": "大树修剪",
    "จัดทรงพุ่ม ลดความเสี่ยงกิ่งหักก่อนหน้าฝน เปิดทรงให้ลมผ่าน และตัดกิ่งที่พาดสายไฟหรือคลุมหลังคา":
      "整理树冠、在雨季前降低断枝风险、疏枝透风，并剪除搭在电线或屋顶上的枝条。",
    "สวนแนวตั้งและบูธอีเว้นต์": "垂直绿墙与展会展位",
    "ผนังต้นไม้จริงสำหรับบูธแสดงสินค้า ร้านค้า และผนังในอาคาร ติดตั้งไว ถอดเก็บได้ พร้อมระบบน้ำและแผนดูแลตลอดงาน":
      "为展位、店铺与室内墙面打造真植物绿墙。安装快、可拆卸，配备灌溉系统与全程养护方案。",

    "เปลี่ยนที่รกร้างเป็นที่เกษตร ลดภาระภาษี และได้ที่ดินที่ยังใช้ประโยชน์ต่อได้":
      "把荒地变成农用地，减轻税负，同时保留仍可使用的土地。",
    "ที่ดินเปล่าเสียภาษีแพงกว่าที่ดินเพื่อการเกษตรหลายเท่า": "空地的税率比农用地高出数倍",
    "ที่ดินเปล่าที่ปล่อยรกร้างเสียภาษีในอัตราสูงกว่าที่ดินเพื่อการเกษตรมาก เรารับปรับที่ดินให้เข้าเกณฑ์การใช้ประโยชน์ทางการเกษตร ตั้งแต่ปรับพื้นที่ เลือกชนิดพืช ปลูกตามอัตราที่กำหนด ไปจนถึงดูแลต่อเนื่อง":
      "闲置空地的税率远高于农用地。我们负责把土地整备到符合农业用途标准：平整场地、挑选合适作物、按规定密度种植，并持续养护。",
    "ประเมินที่ดินและเกณฑ์": "评估土地与标准",
    "ดูขนาดแปลง สภาพพื้นที่ และชนิดพืชที่เหมาะ": "查看地块面积、场地状况与适合的作物。",
    "ปรับพื้นที่และปลูก": "整地与种植",
    "ถางปรับหน้าดิน วางแนวปลูก ลงต้นตามจำนวนต่อไร่": "清除杂草、平整表土、放线定位，按每莱规定的株数种植。",
    "ดูแลต่อเนื่อง": "持续养护",
    "ให้ต้นไม้อยู่รอดและที่ดินคงสภาพใช้ประโยชน์ตลอดปี": "让植物存活，土地全年保持可用状态。",
    "สอบถามที่ดินของคุณ": "咨询您的土地",
    "รอภาพจริง 01": "实拍照片待补 01",
    "รอภาพจริง 02": "实拍照片待补 02",
    "รอภาพจริง 03": "实拍照片待补 03",
    "ที่ดินก่อนปรับ": "整地前的土地",
    "ภาพแปลงที่ยังรกร้าง ถ่ายให้เห็นทั้งแปลง": "尚未整理的地块，拍出整片范围。",
    "ระหว่างปรับพื้นที่": "整地过程中",
    "ตอนถางและวางแนวปลูก": "清理场地并放线定位时。",
    "หลังปลูกเสร็จ": "种植完成后",
    "แปลงที่ปลูกตามเกณฑ์เรียบร้อยแล้ว": "已按标准完成种植的地块。",
    "หมายเหตุ อัตราภาษีและเกณฑ์การใช้ประโยชน์ทางการเกษตรเป็นไปตามประกาศของทางราชการและอาจเปลี่ยนแปลงได้ เราช่วยดำเนินการด้านพื้นที่และการปลูก ส่วนการยื่นและการพิจารณาเป็นอำนาจของหน่วยงานท้องถิ่น":
      "备注：税率与农业用途标准依政府公告执行，可能有所变动。我们负责土地整备与种植，申报与审批属于地方主管机关的权限。",

    "แตะที่ไอคอนเพื่อดูรายละเอียดแต่ละขั้น ทุกงานเดินตามหกขั้นตอนนี้เหมือนกัน คุณจะรู้ตลอดว่าตอนนี้อยู่ตรงไหน":
      "点击图标查看每一步的细节。每个项目都走同样的六个步骤，您随时清楚进行到哪里。",
    "สอบถามความต้องการ": "了解您的需求",
    "คุยว่าอยากใช้สวนทำอะไร ชอบแนวไหน มีใครใช้พื้นที่บ้าง และตั้งงบไว้ประมาณเท่าไหร่ ขั้นนี้คุยทางโทรศัพท์หรือแชทก็ได้":
      "聊聊您想用花园做什么、喜欢什么风格、有谁会使用这片空间、预算大约多少。这一步用电话或聊天即可完成。",
    "ตอนคุยงานกับลูกค้า": "与客户沟通需求时",
    "สำรวจพื้นที่และวัดระยะ": "现场勘测与测量",
    "เข้าไปดูหน้างานจริง วัดขนาด ดูทิศแดด ทิศลม สภาพดิน จุดที่น้ำขัง และแนวท่อกับสายไฟ ข้อมูลชุดนี้คือสิ่งที่ทำให้แบบใช้ได้จริง":
      "到现场实地查看、测量尺寸、确认日照与风向、土壤状况、积水点，以及管线走向。正是这些资料让方案真正可行。",
    "ค่าดำเนินการเริ่มต้น 2,000 บาท": "起价 2,000 泰铢",
    "ทีมงานกำลังวัดระยะหน้างาน": "团队在现场测量",
    "นำเสนอแบบ 3 มิติ": "提交 3D 设计方案",
    "เห็นภาพสวนก่อนลงมือจริง ทั้งมุมมองและขนาดต้นไม้เมื่อโตเต็มที่ ปรับแบบได้จนกว่าคุณจะพอใจ":
      "在动工之前先看到花园的样子，包括视角与植物长成后的尺寸。可以一直修改到您满意为止。",
    "ภาพแบบ 3 มิติที่เคยเสนอลูกค้า": "曾提交给客户的 3D 效果图",
    "ทำใบเสนอราคา": "出具报价单",
    "แจกแจงทุกรายการ ค่าต้นไม้ ค่าวัสดุ และค่าแรง แยกให้เห็นทีละบรรทัด ไม่มีค่าใช้จ่ายที่โผล่มาทีหลัง":
      "逐项列明：苗木、材料与人工分行显示。不会事后冒出额外费用。",
    "ตัวอย่างใบเสนอราคา": "报价单示例",
    "ดำเนินการและส่งมอบ": "施工与交付",
    "เตรียมดิน วางระบบน้ำ ขนส่งและปลูก ค้ำยันไม้ใหญ่ เก็บงานพื้นและขอบแปลง แล้วเก็บพื้นที่ให้เรียบร้อยก่อนส่งมอบ":
      "整土、布设灌溉、运输与种植、大树支撑、铺面与花床收边，交付前把场地清理干净。",
    "หน้างานตอนลงต้นไม้": "种植时的施工现场",
    "ดูแลตามการรับประกัน": "保固期内养护",
    "ช่วงตั้งตัวเป็นช่วงที่ต้นไม้ตายง่ายที่สุด เราตามดูแลจนต้นแข็งแรง และรับดูแลต่อเป็นรายเดือนถ้าคุณต้องการ":
      "扎根期是植物最容易死亡的阶段。我们会一直照料到植株强健，之后也可按月继续养护。",
    "สวนหลังส่งมอบไปแล้วหลายเดือน": "交付数月后的花园",

    "งานที่ผ่านมา": "过往案例",
    "ภาพจากหน้างานจริง ชี้ที่ภาพเพื่อดูสภาพก่อนลงมือทำ": "来自真实工地的照片。指向图片可看到施工前的状况。",
    "ก่อน": "施工前",
    "หลัง": "施工后",
    "ชี้เพื่อดูก่อนทำ": "指向查看施工前",
    "สวนหน้าบ้าน บ้านเดี่ยว": "独栋别墅前庭",
    "ปูหญ้าใหม่ทั้งแปลง วางทางเดินและแปลงไม้พุ่ม": "整片重新铺草，铺设步道与灌木花床。",
    "สวนใต้ต้นไม้ใหญ่": "大树下的花园",
    "เก็บต้นเดิมไว้ ตัดเถาวัลย์ จัดแปลงและมุมนั่งเล่นใหม่": "保留原有树木，清除藤蔓，重新规划花床与休息角落。",
    "สวนแนวตั้ง บูธอีเว้นต์": "垂直绿墙，展会展位",
    "ผนังต้นไม้จริงสำหรับงานแสดงสินค้า": "为商展打造的真植物绿墙。",
    "ผลงาน 04": "案例 04",
    "ผลงาน 05": "案例 05",
    "ผลงาน 06": "案例 06",
    "สวนโครงการหรือพื้นที่ส่วนกลาง": "项目或公共区域花园",
    "ระเบียงหรือดาดฟ้า": "阳台或屋顶",
    "งานดูแลรายเดือน — ก่อนและหลังตัดแต่ง": "每月养护 — 修剪前后对比",
    "ภาพก่อนหน้า": "上一张",
    "ภาพถัดไป": "下一张",
    "ไปที่ภาพที่": "跳到第 ",

    "เครื่องมือฟรี": "免费工具",
    "ลองจัดสวนหน้ากำแพงด้วยตัวเองก่อนคุยกับเรา": "在联系我们之前，先自己试着设计一面墙前的花园",
    "เลือกต้นไม้ วางเป็นชั้น ดูว่าโตเต็มที่แล้วจะบังได้แค่ไหน แล้วส่งแบบมาให้เราประเมินฟรี ไม่ต้องสมัคร ไม่ต้องเซฟ":
      "挑选植物、分层布置、看看长成后能遮挡多少，再把方案发给我们免费评估。无需注册，无需保存。",
    "เปิดเครื่องมือ": "打开工具",
    "ให้เราออกแบบให้": "让我们来设计",
    "ต้นไม้ 92 ชนิดที่ใช้จริงในงานกรุงเทพฯ": "92 种曼谷项目实际使用的植物",
    "ดูได้ทั้งมุมมองด้านหน้าและผังจากด้านบน": "可查看正视图与俯视平面图",
    "เตือนให้เมื่อปลูกชิดกำแพงเกินไปหรือทรงพุ่มจะชนกัน": "种得离墙太近或树冠会相撞时会提醒您",
    "ประเมินช่วงราคาค่าต้นไม้เบื้องต้นให้ทันที": "立即给出苗木费用的大致区间",

    "เรื่องที่ลูกค้าถามก่อนเสมอ": "客户总是先问的问题",
    "ถ้าคำถามของคุณไม่อยู่ในนี้ ทักมาถามได้เลย เราตอบให้ฟรีแม้จะยังไม่ได้จ้างงาน":
      "如果这里没有您的问题，直接发消息给我们。即使还没合作，我们也免费解答。",
    "ต้นไม้ควรปลูกห่างจากตัวบ้านเท่าไหร่": "树应该离房子多远种植？",
    "ขึ้นกับระบบรากและทรงพุ่มของแต่ละชนิด ไม้รากแผ่ตื้นอย่างหูกระจงหรือหางนกยูงฝรั่งควรห่างจากตัวอาคารและพื้นปูอย่างน้อยห้าเมตร ส่วนไม้ที่รากไม่ทำลายโครงสร้างอย่างล่ำซำหรือแก้วปลูกใกล้กว่านั้นได้ หลักง่าย ๆ คือเผื่อระยะเท่ากับครึ่งหนึ่งของความกว้างทรงพุ่มเมื่อโตเต็มที่ แล้วบวกเพิ่มถ้าชนิดนั้นรากแรง":
      "取决于每个树种的根系与树冠。浅根横向扩张的树种，如 Terminalia ivorensis 或凤凰木（Delonix regia），应离建筑和铺面至少五米。根系不破坏结构的树种，如九里香（Murraya paniculata），则可种得更近。简单原则：预留成年树冠宽度的一半，若该树种根系强势就再加一些。",
    "ค่าออกแบบคิดอย่างไร": "设计费怎么计算？",
    "ค่าดำเนินการสำรวจพื้นที่และวัดระยะเริ่มต้นที่ 2,000 บาท ซึ่งรวมการเข้าไปดูหน้างานจริงและเก็บข้อมูลพื้นที่ จากนั้นเรานำเสนอแบบ 3 มิติให้ดูก่อน ปรับแบบได้จนพอใจ แล้วจึงทำใบเสนอราคาที่แยกค่าต้นไม้ ค่าวัสดุ และค่าแรงให้เห็นชัดเจน":
      "现场勘测与测量起价 2,000 泰铢，包含实地查看与采集场地资料。之后我们提供 3D 效果图供您审阅，可修改到满意为止，然后才出报价单，把苗木费、材料费与人工费清楚分开列明。",
    "ไม้มงคลที่รากทำลายบ้าน ควรปลูกไหม": "根系会损坏房屋的吉祥树，该种吗？",
    "ปลูกได้ แต่ต้องแยกสองเรื่องออกจากกัน ความเชื่อเป็นเรื่องหนึ่ง ความปลอดภัยของโครงสร้างเป็นอีกเรื่องหนึ่ง ต้นอย่างโพธิ์ ไทร และขนุน เป็นไม้มงคลตามความเชื่อไทยแต่รากไปไกลและแรงมาก ถ้าอยากได้ทั้งสองอย่าง เราจะเสนอให้ปลูกไว้ท้ายที่ดินห่างจากตัวบ้าน หรือปลูกลงกระถางใหญ่ที่คุมรากได้":
      "可以种，但要把两件事分开：信仰是一回事，结构安全是另一回事。菩提树、榕树与菠萝蜜在泰国信仰中是吉祥树，但根系走得远、力量强。若两者都想兼顾，我们建议种在地块后方、远离房屋处，或种进能约束根系的大盆里。",
    "สวนแบบไหนดูแลน้อยที่สุด": "哪种花园最省心？",
    "เลือกไม้ไม่ผลัดใบและใบร่วงน้อยเป็นโครงหลัก อย่างกันเกรา พิกุล หรืออโศกอินเดีย เลี่ยงไม้ผลและไม้ที่ดอกร่วงหนักถ้าอยู่ใกล้สระหรือทางเดิน ใช้ไม้คลุมดินแทนสนามหญ้าในจุดที่ตัดยาก และวางระบบน้ำอัตโนมัติตั้งแต่แรก":
      "以落叶少的常绿乔木作为骨架，例如 Fagraea fragrans、Mimusops elengi 或印度塔树（Polyalthia longifolia）。泳池或步道附近避免果树和落花多的品种。修剪不便的地方用地被植物代替草坪，并从一开始就装设自动灌溉。",
    "รับงานพื้นที่ไหนบ้าง": "服务范围有哪些？",
    "กรุงเทพฯ และปริมณฑลเป็นหลัก งานต่างจังหวัดพิจารณาเป็นรายงานตามขนาดและระยะทาง ทักมาสอบถามได้เลย":
      "主要服务曼谷及周边府。外府项目视规模与距离逐案考虑，欢迎直接咨询。",

    "ปรึกษาฟรี ไม่มีค่าใช้จ่าย": "免费咨询，不收任何费用",
    "ส่งรูปพื้นที่กับขนาดคร่าว ๆ มาก่อนก็ได้ เราประเมินเบื้องต้นให้ฟรี เลือกช่องทางที่คุณสะดวกได้เลย":
      "先把场地照片与大致尺寸发给我们即可，我们免费做初步评估。选择您方便的联络方式。",
    "ส่งอะไรมาให้เราบ้าง": "需要提供什么",
    "ยิ่งครบ ยิ่งประเมินได้เร็วและแม่น": "资料越齐全，评估越快也越准确",
    "รูปพื้นที่ ถ่ายกว้าง ๆ สักสองสามมุม": "场地照片，两三个角度的广角照",
    "ขนาดพื้นที่โดยประมาณ กว้างคูณยาว": "大致面积，宽 × 长",
    "แดดเข้าทางไหน ช่วงเช้าหรือช่วงบ่าย": "阳光从哪个方向照进来，上午还是下午",
    "เคยมีน้ำขังไหม ลึกแค่ไหน นานกี่วัน": "是否积过水，多深，持续几天",
    "มีเด็กเล็กหรือสัตว์เลี้ยงไหม": "家中是否有幼儿或宠物",
    "งบประมาณที่วางไว้คร่าว ๆ": "大致的预算范围",

    "Always Trees รับออกแบบและจัดสวน ดูแลสวนรายเดือน ตัดแต่งต้นไม้ใหญ่ สวนแนวตั้ง และปรับที่รกร้างเป็นที่เกษตรเพื่อลดภาษีที่ดิน บริการกรุงเทพฯ และปริมณฑล ปรึกษาฟรี":
      "Always Trees — 花园设计与施工、每月花园养护、大树修剪、垂直绿墙，以及把荒地整备为农用地以降低土地税。服务曼谷及周边府，免费咨询。",
    "Always Trees หน้าแรก": "Always Trees 首页",
    "เปิดเมนู": "打开菜单",
    "ปิดเมนู": "关闭菜单",
    "สวนหน้าบ้านบ้านเดี่ยวหลังจัดใหม่": "独栋别墅前庭重新造园后",
    "สวนใต้ต้นไม้ใหญ่หลังปรับปรุง": "大树下的花园改造后",
    "สวนแนวตั้งบนบูธอีเว้นต์": "展会展位上的垂直绿墙",
    "สวนหน้าบ้านหลังจัดใหม่": "前庭重新造园后",
    "สวนหน้าบ้านก่อนจัด": "前庭施工前",
    "สวนใต้ต้นไม้ใหญ่ก่อนปรับปรุง": "大树下的花园改造前",
    "บริการของ Always Trees": "Always Trees 服务项目",
    "ลดภาษีที่ดิน เปลี่ยนที่รกร้างเป็นที่เกษตร": "降低土地税 — 把荒地转为农用地",
    "กรุงเทพมหานคร": "曼谷",
    "ปริมณฑล": "周边府"
  };

  var DICT = { en: EN, zh: ZH };

  /* ข้อความที่มีตัวเลขแทรก จับด้วยรูปแบบแทนการจับคำตรง ๆ */
  var PATTERNS = [
    { re: /^ขั้นที่\s*(\d+)\s*จาก\s*(\d+)$/, en: "Step $1 of $2", zh: "第 $1 步，共 $2 步" }
  ];
  var ATTRS = ["placeholder", "alt", "title", "aria-label", "content"];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1 };
  var lang = "th";
  var busy = false;

  function stored() {
    try { return localStorage.getItem("at_lang"); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem("at_lang", v); } catch (e) { }
  }

  /* แปลข้อความหนึ่งชิ้น คืนค่าเดิมถ้าไม่มีคำแปล */
  function tr(src) {
    if (lang === "th") return src;
    var d = DICT[lang];
    if (!d) return src;
    var key = src.trim();
    var hit = d[key];
    if (hit === undefined) {
      for (var i = 0; i < PATTERNS.length; i++) {
        var P = PATTERNS[i];
        if (P.re.test(key) && P[lang]) return src.replace(key, key.replace(P.re, P[lang]));
      }
      return src;
    }
    // รักษาช่องว่างหน้า/หลังของเดิมไว้ เพราะบางจุดเป็นข้อความต่อกับแท็กอื่น
    return src.replace(key, hit);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 1) {
      // แอตทริบิวต์
      for (var a = 0; a < ATTRS.length; a++) {
        var name = ATTRS[a];
        if (!root.hasAttribute || !root.hasAttribute(name)) continue;
        if (name === "content" && root.tagName !== "META") continue;
        var okey = "atI18n" + a;
        if (root.dataset[okey] === undefined) root.dataset[okey] = root.getAttribute(name);
        var orig = root.dataset[okey];
        var out = tr(orig);
        if (out !== root.getAttribute(name)) root.setAttribute(name, out);
      }
    }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (p && SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node, list = [];
    while ((node = w.nextNode())) list.push(node);
    list.forEach(function (t) {
      if (t.__atOrig === undefined) t.__atOrig = t.nodeValue;
      var out = tr(t.__atOrig);
      if (t.nodeValue !== out) t.nodeValue = out;
    });
    // แอตทริบิวต์ของลูกทั้งหมด
    if (root.querySelectorAll) {
      var sel = ATTRS.map(function (a) { return "[" + a + "]"; }).join(",");
      root.querySelectorAll(sel).forEach(function (el) { walkAttrs(el); });
    }
  }
  function walkAttrs(el) {
    for (var a = 0; a < ATTRS.length; a++) {
      var name = ATTRS[a];
      if (!el.hasAttribute(name)) continue;
      if (name === "content" && el.tagName !== "META") continue;
      var okey = "atI18n" + a;
      if (el.dataset[okey] === undefined) el.dataset[okey] = el.getAttribute(name);
      var out = tr(el.dataset[okey]);
      if (out !== el.getAttribute(name)) el.setAttribute(name, out);
    }
  }

  function apply() {
    busy = true;
    var L = LANGS.filter(function (x) { return x.k === lang; })[0] || LANGS[0];
    document.documentElement.setAttribute("lang", L.html);
    document.documentElement.setAttribute("data-lang", lang);
    walk(document.head);
    walk(document.body);
    if (document.title) {
      if (!document.documentElement.dataset.atTitle) document.documentElement.dataset.atTitle = document.title;
      document.title = tr(document.documentElement.dataset.atTitle);
    }
    document.querySelectorAll(".at-lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    busy = false;
  }

  function setLang(v) {
    lang = v; store(v); apply();
  }

  /* ---------- ปุ่มสลับภาษา ---------- */
  function switcher(extraClass) {
    var d = document.createElement("div");
    d.className = "at-lang" + (extraClass ? " " + extraClass : "");
    LANGS.forEach(function (L) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.lang = L.k;
      b.textContent = L.label;
      b.setAttribute("aria-pressed", String(L.k === lang));
      b.addEventListener("click", function () { setLang(L.k); });
      d.appendChild(b);
    });
    return d;
  }

  function mount() {
    var css = document.createElement("style");
    css.textContent = [
      '.at-lang{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--tint);',
      '  box-shadow:var(--sh1,0 1px 2px rgba(18,33,26,.06));flex:0 0 auto}',
      '.at-lang button{border:none;background:transparent;cursor:pointer;color:var(--ink-2);',
      '  font-family:"Prompt","Noto Sans Thai",system-ui,sans-serif;font-size:12.5px;font-weight:500;',
      '  padding:5px 11px;border-radius:999px;line-height:1.4;transition:background .18s,color .18s}',
      '.at-lang button:hover{color:var(--brand)}',
      '.at-lang button[aria-pressed="true"]{background:var(--brand);color:#FFF}',
      '.at-lang button:focus-visible{outline:2px solid var(--brand);outline-offset:2px}',
      '.at-lang.drawer-lang{display:flex;margin:14px 0 4px;justify-content:center}',
      '@media (max-width:1040px){#nav .at-lang{display:none}}',
      /* จีนไม่มีในฟอนต์ Prompt/Noto Sans Thai จึงต้องต่อฟอนต์ระบบให้ */
      ':root[data-lang="zh"] body,:root[data-lang="zh"] h1,:root[data-lang="zh"] h2,',
      ':root[data-lang="zh"] h3,:root[data-lang="zh"] h4,:root[data-lang="zh"] .btn,',
      ':root[data-lang="zh"] .tabs a,:root[data-lang="zh"] p,:root[data-lang="zh"] li,',
      ':root[data-lang="zh"] span,:root[data-lang="zh"] a,:root[data-lang="zh"] div',
      '{font-family:"Prompt","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC",',
      '  "Noto Sans SC","Heiti SC",system-ui,sans-serif}',
      ':root[data-lang="zh"] body{line-height:1.9;letter-spacing:.01em}',
      ':root[data-lang="en"] body{letter-spacing:0}'
    ].join("\n");
    document.head.appendChild(css);

    var navWrap = document.querySelector("#nav .wrap");
    var cta = navWrap && navWrap.querySelector("a.btn-green");
    if (navWrap && cta) navWrap.insertBefore(switcher(), cta);

    var drawer = document.getElementById("drawer");
    var dcta = drawer && drawer.querySelector("a.btn-green");
    if (drawer && dcta) drawer.insertBefore(switcher("drawer-lang"), dcta);
    else if (drawer) drawer.appendChild(switcher("drawer-lang"));
  }

  function start() {
    var s = stored();
    if (s && (s === "th" || DICT[s])) lang = s;
    mount();
    apply();
    /* เนื้อหาบางส่วนถูกสร้างด้วยจาวาสคริปต์ทีหลัง (ขั้นตอน 6 ขั้น แคปชันสไลด์)
       จึงต้องคอยแปลของที่เพิ่มเข้ามาใหม่ด้วย */
    if (window.MutationObserver) {
      var mo = new MutationObserver(function (recs) {
        if (busy || lang === "th") return;
        busy = true;
        recs.forEach(function (r) {
          r.addedNodes && r.addedNodes.forEach && r.addedNodes.forEach(function (nd) {
            if (nd.nodeType === 1) walk(nd);
            else if (nd.nodeType === 3 && nd.nodeValue && nd.nodeValue.trim()) {
              if (nd.__atOrig === undefined) nd.__atOrig = nd.nodeValue;
              nd.nodeValue = tr(nd.__atOrig);
            }
          });
        });
        busy = false;
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
