// Every string on the page, in both languages. The numbers, hashes and
// answers come from a real run of the contract on a local devnet
// (17 Nov 2026, question da39718d…0ce0); nothing here is invented data.

export type Lang = 'en' | 'tr';

export type Segment = { t: string; tag?: string; to?: string };

export const REAL = {
  question: 'da39718ddb298e0aee7261539f8589ec4bb5be610e9d1a8bdacf176cabdc0ce0',
  rulesHash: 'c617d161a7d1334f6cdda1ebb320ca2d034c2100b6a502236b401bf8126b148c',
  removedId: '866214713bac0a7592f53bcfe72deccc97501032c8df87c0cb900baa00ae3cc3',
  repo: 'https://github.com/Bekirerdem/stele/tree/v2',
  // examples/leaving.rules.json, line-wrapped for display only.
  rules: [
    '{',
    '  "version": 1,',
    '  "title": "Ayrılmayı düşünüyor musun?",',
    '  "prompts": ["Önümüzdeki 6 ayda ayrılmayı',
    '     düşünüyor musun? Neden?"],',
    '  "visibility": "asker_only",',
    '  "minAnswers": 3,',
    '  "moderation": {',
    '    "remove": ["insult", "threat", "doxxing", "hate"],',
    '    "model": "z-ai/glm-5.3-flash",',
    '    "provider": "near-ai-tee" },',
    '  "promise": "Sonuçlar ayrılma niyetini %30\'un',
    '     üzerinde gösterirse, 30 gün içinde ekiple açık',
    '     bir toplantı yapıp somut adımları paylaşacağız."',
    '}',
  ],
};

const en = {
  nav: { how: 'How it works', who: 'Who sees what', verify: 'Verify', code: 'Code', lang: 'TR' },
  tag: 'on Midnight',
  hero: {
    eyebrow: '01  The question',
    title: ['Ask the question', "people can't", 'answer honestly.'],
    sub: 'Members answer in their own words without paying for it. Every answer provably comes from a real member, one per person, and none can be quietly buried.',
    scroll: 'Scroll',
    said: "I'm fine.",
    thoughts: [
      "I'm leaving in spring.",
      'My manager is the problem.',
      "I'm burned out.",
      "I don't believe the plan.",
      'I saw something.',
      "Pay hasn't moved in two years.",
      "I'm actually fine.",
      'Nobody listens.',
      "I'm interviewing.",
      "I'm scared to say it.",
      'The reorg was a mistake.',
      'I want to stay. Fix this.',
    ],
    beat1: 'What people say is what is safe to say.',
    beat2: 'One of them is you.',
    you: 'What would you say if nobody could trace it back?',
  },
  cost: {
    eyebrow: '02  The price of an honest answer',
    title: 'People say what is safe, not what they think.',
    body: 'The economist Timur Kuran called it preference falsification. When an honest answer has a price, people pay in silence, and whoever asked makes decisions on answers that were never true.',
    rows: [
      { k: 'Power', line: 'Your manager reads it.', q: 'Would you leave in the next six months?' },
      { k: 'Stigma', line: 'It sticks to your name.', q: 'Have you struggled with your mental health this year?' },
      { k: 'The room', line: 'Everyone already agreed.', q: 'Do you actually believe in the plan we voted for?' },
      { k: 'Complicity', line: 'You were there too.', q: 'Have you seen something here that should have been reported?' },
    ],
  },
  anon: {
    eyebrow: '03  Why "anonymous" is not',
    title: '"Anonymous" usually means: trust us.',
    points: [
      'The form owner keeps both the answers and the list of who answered.',
      'Your writing gives you away. Language models put the real author in their top five guesses 74% of the time.',
    ],
    cite: 'arXiv 2601.12407',
    fix: 'Stele closes the first gap with Midnight and the second with a shield.',
    before: 'honestly bro pay hasnt moved in 2 yrs… mgmt never listens 🙄',
    tells: ['honestly bro', '2 yrs', 'mgmt', '🙄'],
    after: 'Pay has not increased in a long time, and management does not listen.',
    beforeLabel: 'Draft',
    afterLabel: 'After the shield',
  },
  how: {
    eyebrow: '04  How one question works',
    steps: [
      {
        title: 'The rules are carved before anyone answers.',
        body: 'Who answers, who reads, the minimum number of answers and the promise the asker makes are hashed into the contract when it is deployed. Nobody can change them afterwards.',
        note: 'rules hash, fixed at deploy',
      },
      {
        title: 'Members prove they belong, not who they are.',
        body: "Each member's key is a leaf in a Merkle tree. A zero-knowledge proof says one of these three, and nothing more. Midnight's compiler refuses code that would leak the secret.",
        note: 'membership proof',
      },
      {
        title: 'A shield reads your draft before anyone else can.',
        body: 'The draft is encrypted to a NEAR AI enclave (Intel TDX + NVIDIA) and checked for details that could point to you. You decide what gets generalized. Every reply is signed by the enclave.',
        note: 'enclave signature verified',
      },
      {
        title: 'One person, one answer. Only a fingerprint goes on chain.',
        body: 'A one-time stamp blocks a second answer; you can revise until the deadline and only the last one counts. The text is padded to a fixed size and sealed for the asker.',
        note: 'padded · sealed · fingerprinted',
      },
      {
        title: 'Nothing opens early. Nothing disappears quietly.',
        body: 'Answers open only after the deadline, and only if at least three came in. A moderator can remove an insult, but the removal stays visible to everyone, with its reason.',
        note: 'removed, and everyone can see it',
      },
    ],
    member: 'member',
    empty: 'empty',
    oneOf: 'one of 3 · which one stays hidden',
    draft: [
      { t: 'Last Tuesday in sprint planning', tag: 'time + place', to: 'In a meeting' },
      { t: ', ' },
      { t: 'Mehmet', tag: 'name', to: 'a teammate' },
      { t: ' tore my design apart in front of everyone, so I stopped sharing ideas. ' },
      { t: "I'm the only UX designer on the team.", tag: 'role', to: '' },
    ] as Segment[],
    bucket: 'padded to 1 KB',
    sealed: 'sealed for the asker',
    stamp: 'one-time stamp',
    chain: 'on chain',
    phaseOpen: 'open',
    phaseClosed: 'closed',
    answers: [
      'In a meeting, a teammate tore my design apart in front of everyone, so I stopped sharing ideas. Yes, I am thinking of leaving.',
      'Pay has not increased in a long time, and management does not listen.',
      'This manager is a total idiot, I am not staying.',
    ],
    removed: 'removed: insult · visible to everyone',
    realRun: 'Real run · local devnet · 17 Nov · translated',
    locked: 'locked until close and 3 answers',
  },
  sees: {
    eyebrow: '05  Who sees what',
    title: 'No party ever holds the text and the author together.',
    cols: ['sees', 'never sees'],
    rows: [
      { who: 'Midnight', sees: 'that a member answered, a fingerprint, the counts', never: 'who answered, or what they wrote' },
      { who: 'The shield', sees: 'the draft, for a few seconds, inside the enclave', never: 'who wrote it; nothing is logged' },
      { who: 'The asker', sees: 'every answer, after close', never: 'which member wrote which answer' },
      { who: 'The relay', sees: 'encrypted bytes', never: 'the text, or the author' },
    ],
  },
  verify: {
    eyebrow: '06  Check it yourself',
    title: "Don't trust this page. Run the mirror.",
    body: 'Anyone can compare the rules, the counts and every stored answer with what the contract holds. One command.',
  },
  limits: {
    eyebrow: '07  What we will not claim',
    rows: [
      { no: 'Fully anonymous', yes: 'Pseudonymous, with cryptographic protection.' },
      { no: 'The AI makes you safe', yes: 'The shield helps. You make the final call.' },
      { no: 'One human, one answer', yes: 'One member key, one answer. Not proof of personhood.' },
      { no: 'Untraceable timing', yes: 'Timing can still correlate. Answer when it suits you, not first.' },
      { no: 'Audited', yes: 'Not audited yet. The code is open.' },
    ],
  },
  end: {
    eyebrow: '08  Built on Midnight',
    title: 'The answers a team needs are the ones it never hears.',
    status: 'Contract deploying to Midnight Preprod',
    code: 'Read the code',
    foot: 'MIT licensed · contract, shield, CLI and relay on branch v2',
  },
};

const tr: typeof en = {
  nav: { how: 'Nasıl çalışır', who: 'Kim neyi görür', verify: 'Doğrula', code: 'Kod', lang: 'EN' },
  tag: "Midnight'ta",
  hero: {
    eyebrow: '01  Soru',
    title: ['İnsanların dürüstçe', 'cevaplayamadığı', 'soruyu sor.'],
    sub: 'Üyeler bedel ödemeden, kendi sözleriyle cevap verir. Her cevabın gerçek bir üyeden geldiği kanıtlanır, kişi başı bir cevap, hiçbiri sessizce gömülemez.',
    scroll: 'Kaydır',
    said: 'Her şey yolunda.',
    thoughts: [
      'Baharda ayrılıyorum.',
      'Sorun yöneticim.',
      'Tükendim.',
      'Plana inanmıyorum.',
      'Bir şey gördüm.',
      'Maaş iki yıldır aynı.',
      'Gerçekten iyiyim.',
      'Kimse dinlemiyor.',
      'Mülakatlara giriyorum.',
      'Söylemeye korkuyorum.',
      'Yeniden yapılanma hataydı.',
      'Kalmak istiyorum. Düzeltin.',
    ],
    beat1: 'İnsanlar söylemesi güvenli olanı söyler.',
    beat2: 'Bunlardan biri sensin.',
    you: 'Kimse sana kadar izini süremeseydi ne derdin?',
  },
  cost: {
    eyebrow: '02  Dürüst cevabın bedeli',
    title: 'İnsanlar düşündüğünü değil, güvenli olanı söyler.',
    body: 'Ekonomist Timur Kuran buna tercih çarpıtması dedi. Dürüst cevabın bir bedeli olduğunda insanlar sessizlikle öder; soran da hiç doğru olmamış cevaplara bakarak karar verir.',
    rows: [
      { k: 'Güç', line: 'Yöneticin okuyacak.', q: 'Önümüzdeki altı ayda ayrılmayı düşünüyor musun?' },
      { k: 'Damga', line: 'Adına yapışır.', q: 'Bu yıl ruh sağlığınla ilgili zorlandın mı?' },
      { k: 'Oda', line: 'Herkes çoktan kabul etti.', q: 'Oyladığımız plana gerçekten inanıyor musun?' },
      { k: 'Suç ortaklığı', line: 'Sen de oradaydın.', q: 'Burada bildirilmesi gereken bir şey gördün mü?' },
    ],
  },
  anon: {
    eyebrow: "03  'Anonim' neden anonim değil",
    title: "'Anonim' çoğu zaman 'bize güven' demek.",
    points: [
      'Formun sahibi hem cevapları hem de kimin cevapladığının listesini tutar.',
      'Yazı üslubun seni ele verir. Dil modelleri gerçek yazarı ilk beş tahminine %74 oranında koyuyor.',
    ],
    cite: 'arXiv 2601.12407',
    fix: "Stele ilk açığı Midnight'la, ikincisini kalkanla kapatır.",
    before: 'valla kanka maaşlar 2 yıldır artmadı… yönetim hiç dinlemiyo 🙄',
    tells: ['valla kanka', '2 yıldır', 'dinlemiyo', '🙄'],
    after: 'Maaşlar uzun süredir artmadı, yönetim hiç dinlemiyor.',
    beforeLabel: 'Taslak',
    afterLabel: 'Kalkandan sonra',
  },
  how: {
    eyebrow: '04  Bir soru nasıl işler',
    steps: [
      {
        title: 'Kurallar, kimse cevap vermeden kazınır.',
        body: 'Kim cevaplar, kim okur, en az kaç cevap gerekir ve soranın verdiği söz; sözleşme kurulurken özetlenip içine yazılır. Sonradan kimse değiştiremez.',
        note: 'kural özeti, kurulumda sabitlendi',
      },
      {
        title: 'Üyeler kim olduklarını değil, üye olduklarını kanıtlar.',
        body: 'Her üyenin anahtarı bir Merkle ağacında bir yaprak. Sıfır bilgi kanıtı yalnızca "bu üç kişiden biri" der, fazlasını değil. Midnight derleyicisi sırrı sızdıracak kodu reddeder.',
        note: 'üyelik kanıtı',
      },
      {
        title: 'Taslağını senden önce bir kalkan okur, başka kimse değil.',
        body: "Taslak, NEAR AI'ın güvenli bölgesine (Intel TDX + NVIDIA) şifreli gider ve seni ele verebilecek ayrıntılar işaretlenir. Neyin genelleşeceğine sen karar verirsin. Her cevap güvenli bölge tarafından imzalanır.",
        note: 'güvenli bölge imzası doğrulandı',
      },
      {
        title: 'Kişi başı bir cevap. Zincire yalnızca iz gider.',
        body: 'Tek kullanımlık damga ikinci cevabı engeller; süre bitene kadar değiştirebilirsin, sayılan son cevaptır. Metin sabit boyuta doldurulur ve soran için mühürlenir.',
        note: 'dolduruldu · mühürlendi · iz alındı',
      },
      {
        title: 'Hiçbir şey erken açılmaz. Hiçbir şey sessizce kaybolmaz.',
        body: 'Cevaplar yalnızca süre bitince ve en az üç cevap geldiyse açılır. Moderatör bir hakareti kaldırabilir ama kaldırma, gerekçesiyle birlikte herkese görünür kalır.',
        note: 'kaldırıldı, herkes görüyor',
      },
    ],
    member: 'üye',
    empty: 'boş',
    oneOf: '3 kişiden biri · hangisi olduğu gizli',
    draft: [
      { t: 'Geçen salı sprint toplantısında', tag: 'zaman + yer', to: 'Bir toplantıda' },
      { t: ' ' },
      { t: 'Mehmet', tag: 'isim', to: 'bir ekip üyesi' },
      { t: ' tasarımımı herkesin önünde rezil etti, artık fikir söylemiyorum. ' },
      { t: "Zaten ekipteki tek UX'çi benim.", tag: 'rol', to: '' },
    ] as Segment[],
    bucket: "1 KB'a dolduruldu",
    sealed: 'soran için mühürlendi',
    stamp: 'tek kullanımlık damga',
    chain: 'zincirde',
    phaseOpen: 'açık',
    phaseClosed: 'kapandı',
    answers: [
      'Bir toplantıda bir ekip üyesi tasarımımı herkesin önünde rezil etti, artık fikir söylemiyorum. Evet, ayrılmayı düşünüyorum.',
      'Maaşlar uzun süredir artmadı, yönetim hiç dinlemiyor.',
      'Bu müdür tam bir salak aq, kalmam.',
    ],
    removed: 'kaldırıldı: hakaret · herkese görünür',
    realRun: 'Gerçek tur · yerel test ağı · 17 Kasım',
    locked: 'kapanış ve 3 cevaba kadar kilitli',
  },
  sees: {
    eyebrow: '05  Kim neyi görür',
    title: 'Hiçbir taraf metni ve yazarını aynı anda tutmaz.',
    cols: ['görür', 'asla görmez'],
    rows: [
      { who: 'Midnight', sees: 'bir üyenin cevap verdiğini, izi, sayıları', never: 'kimin cevapladığını ya da ne yazdığını' },
      { who: 'Kalkan', sees: 'taslağı, birkaç saniye, güvenli bölgenin içinde', never: 'kimin yazdığını; kayıt tutulmaz' },
      { who: 'Soran', sees: 'kapanıştan sonra tüm cevapları', never: 'hangi üyenin hangi cevabı yazdığını' },
      { who: 'Relay', sees: 'şifreli baytları', never: 'metni ya da yazarı' },
    ],
  },
  verify: {
    eyebrow: '06  Kendin kontrol et',
    title: 'Bu sayfaya güvenme. Aynayı çalıştır.',
    body: 'Herkes kuralları, sayıları ve saklanan her cevabı sözleşmedekiyle karşılaştırabilir. Tek komut yeter.',
  },
  limits: {
    eyebrow: '07  İddia etmeyeceklerimiz',
    rows: [
      { no: 'Tamamen anonim', yes: 'Takma adlı, kriptografik korumalı.' },
      { no: 'Yapay zeka seni korur', yes: 'Kalkan yardım eder. Son karar senin.' },
      { no: 'Bir insan, bir cevap', yes: 'Bir üye anahtarı, bir cevap. İnsanlık kanıtı değil.' },
      { no: 'İz bırakmayan zamanlama', yes: 'Zamanlama hâlâ ilişkilendirilebilir. İlk değil, sana uyan anda cevapla.' },
      { no: 'Denetlendi', yes: 'Henüz denetlenmedi. Kod açık.' },
    ],
  },
  end: {
    eyebrow: "08  Midnight'ta inşa edildi",
    title: 'Bir ekibin duyması gereken cevaplar, hiç duymadıklarıdır.',
    status: "Sözleşme Midnight Preprod'a kuruluyor",
    code: 'Kodu oku',
    foot: "MIT lisanslı · sözleşme, kalkan, CLI ve relay v2 branch'inde",
  },
};

export const copy: Record<Lang, typeof en> = { en, tr };
export type Copy = typeof en;
