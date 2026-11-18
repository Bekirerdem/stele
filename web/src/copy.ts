// Every string on the page. Turkish is written as Turkish, English as
// English: neither is a translation of the other. The hashes, counts and
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

const tr = {
  tag: "Midnight'ta",
  nav: { lang: 'EN', code: 'Kod' },
  chapters: ['Soru', 'Bedel', 'Anonim form', 'Nasıl çalışır', 'Kim neyi görür', 'Kendin kontrol et', 'Söz vermediklerimiz', 'Son söz'],
  hero: {
    title: ['Herkes düşünüyor.', 'Kimse söylemiyor.'],
    sub: "Stele'de bir ekibin, topluluğun ya da kurumun üyeleri soruları kendi cümleleriyle cevaplar. Cevabın gerçek bir üyeden geldiği kanıtlanır, kimin yazdığı görünmez, hiçbir cevap sessizce silinemez.",
    scroll: 'Aşağı kaydır',
    said: 'İyiyim.',
    thoughts: [
      'Baharda gidiyorum.',
      'Sorun yöneticimde.',
      'Tükendim.',
      'Bu plana inanmıyorum.',
      'Bir şey gördüm, söyleyemedim.',
      'İki yıldır zam yok.',
      'Gerçekten iyiyim.',
      'Kimse dinlemiyor.',
      'Başka yerlerle görüşüyorum.',
      'Söylemeye korkuyorum.',
      'O yeniden yapılanma hataydı.',
      'Kalmak istiyorum, düzeltin.',
    ],
    beat1: 'İnsanlar düşündüğünü değil, söylemesi güvenli olanı söyler.',
    beat2: 'Bunlardan biri sensin.',
    you: 'Kimse senin yazdığını bilmeseydi ne derdin?',
  },
  cost: {
    title: 'Dürüst cevabın bir bedeli var.',
    body: 'Ekonomist Timur Kuran buna tercih çarpıtması diyor. Bedeli olan yerde insanlar ya susar ya da herkesin duymak istediğini söyler. Soruyu soran da bu cevaplara bakıp karar verir.',
    rows: [
      { k: 'Güç', line: 'Cevabını yöneticin okuyacak.', q: 'Önümüzdeki altı ay içinde ayrılmayı düşünüyor musun?' },
      { k: 'Damga', line: 'Söylediğin adınla anılacak.', q: 'Bu yıl ruh sağlığın zorlandı mı?' },
      { k: 'Grup baskısı', line: 'Herkes çoktan evet dedi.', q: 'Oyladığımız plana gerçekten inanıyor musun?' },
      { k: 'Suç ortaklığı', line: 'Sen de oradaydın.', q: 'Burada bildirilmesi gereken bir şey gördün mü?' },
    ],
    after: 'Sonuç: herkes yine "iyiyim" diyor.',
  },
  anon: {
    title: 'Anonim form da seni korumaz.',
    points: [
      'Formu kuran kişi cevapları da, kimin cevap verdiğini de görür.',
      'Yazış tarzın seni ele verir. Dil modelleri bir metnin yazarını ilk beş tahmininde %74 oranında buluyor.',
    ],
    cite: 'arXiv 2601.12407',
    fix: "Stele ilk sorunu Midnight ile, ikincisini yazı kalkanıyla çözüyor.",
    before: 'valla kanka maaşlar 2 yıldır artmadı… yönetim de hiç dinlemiyo 🙄',
    tells: ['valla kanka', '2 yıldır', 'dinlemiyo', '🙄'],
    after: 'Maaşlar uzun süredir artmadı, yönetim hiç dinlemiyor.',
    beforeLabel: 'Taslak',
    afterLabel: 'Kalkandan sonra',
    names: ['Ayşe', 'Mert', 'Elif', 'Can', 'Zeynep', 'Burak', 'Deniz', 'Ece', 'Emre', 'Selin', 'Kerem', 'İrem', 'Okan', 'Derya', 'Bora', 'Nil'],
  },
  how: {
    steps: [
      {
        title: 'Önce kurallar yazılır. Sonra kimse değiştiremez.',
        body: 'Kimin cevap vereceği, cevapları kimin okuyacağı, en az kaç cevap gerektiği ve soruyu soranın verdiği söz, soru açılırken sözleşmeye işlenir.',
        note: 'kuralların özeti sözleşmede',
      },
      {
        title: 'Üye olduğunu kanıtlarsın, kim olduğunu değil.',
        body: "Her üyenin bir anahtarı var. Sıfır bilgi kanıtı sadece \"bu kişi üç üyeden biri\" der, hangisi olduğunu söylemez. Midnight'ın derleyicisi bu sırrı sızdıracak kodu derlemez bile.",
        note: 'üyelik kanıtı',
      },
      {
        title: 'Göndermeden önce cevabını kalkan okur.',
        body: "Taslağın şifrelenip NEAR AI'ın güvenli bölgesine gider. Kalkan seni ele verebilecek yerleri işaretler: isim, yer, rol. Neyin değişeceğine sen karar verirsin.",
        note: 'güvenli bölgenin imzası doğrulandı',
      },
      {
        title: 'Herkesin tek cevap hakkı var.',
        body: 'Tek kullanımlık damga ikinci cevabı engeller. Süre bitene kadar cevabını değiştirebilirsin, sayılan son cevaptır. Metin sabit boyuta tamamlanır, mühürlenir ve zincire sadece izi gider.',
        note: 'tamamlandı · mühürlendi · izi alındı',
      },
      {
        title: 'Erken açılmaz, sessizce silinmez.',
        body: 'Cevaplar süre dolmadan ve en az üç cevap gelmeden açılmaz. Moderatör hakaret içeren bir cevabı kaldırabilir, ama kaldırıldığı nedeniyle birlikte herkese görünür.',
        note: 'kaldırıldı, herkes görüyor',
      },
    ],
    member: 'üye',
    empty: 'boş',
    oneOf: '3 üyeden biri · hangisi olduğu gizli',
    draft: [
      { t: 'Geçen salı sprint toplantısında', tag: 'zaman + yer', to: 'Bir toplantıda' },
      { t: ' ' },
      { t: 'Mehmet', tag: 'isim', to: 'bir ekip üyesi' },
      { t: ' tasarımımı herkesin önünde rezil etti, artık fikir söylemiyorum. ' },
      { t: "Zaten ekipteki tek UX'çi benim.", tag: 'rol', to: '' },
    ] as Segment[],
    bucket: "1 KB'a tamamlandı",
    sealed: 'soru sahibi için mühürlendi',
    stamp: 'tek kullanımlık damga',
    chain: 'zincirde',
    phaseOpen: 'açık',
    phaseClosed: 'kapandı',
    answers: [
      'Bir toplantıda bir ekip üyesi tasarımımı herkesin önünde rezil etti, artık fikir söylemiyorum. Evet, ayrılmayı düşünüyorum.',
      'Maaşlar uzun süredir artmadı, yönetim hiç dinlemiyor.',
      'Bu müdür tam bir salak aq, kalmam.',
    ],
    removed: 'kaldırıldı: hakaret · herkes görüyor',
    realRun: 'Gerçek deneme · yerel test ağı · 17 Kasım',
    locked: 'süre dolana ve 3 cevap gelene kadar kilitli',
  },
  sees: {
    title: 'Metni ve yazanı aynı anda kimse görmez.',
    body: 'Her taraf işini yapacak kadarını görür. Metinle yazanı bir araya getiren tek bir yer yok.',
    cols: ['görür', 'göremez'],
    rows: [
      { who: 'Midnight', sees: 'bir üyenin cevap verdiğini, cevabın izini, sayıları', never: 'kimin cevap verdiğini, ne yazdığını' },
      { who: 'Kalkan', sees: 'taslağı, birkaç saniyeliğine, güvenli bölgenin içinde', never: 'kimin yazdığını; kayıt da tutmaz' },
      { who: 'Soru sahibi', sees: 'süre dolunca bütün cevapları', never: 'hangi cevabı kimin yazdığını' },
      { who: 'Aktarıcı', sees: 'şifreli veriyi', never: 'metni de yazanı da' },
    ],
  },
  verify: {
    title: 'Bu sayfaya güvenme, kendin kontrol et.',
    body: 'Kuralları, sayıları ve saklanan her cevabı sözleşmedekiyle karşılaştıran tek bir komut var. Herkes çalıştırabilir.',
  },
  limits: {
    title: 'Söz veremeyeceğimiz şeyleri yazmıyoruz.',
    body: 'Gizlilik ürünlerinde en büyük risk, fazla söz vermek.',
    rows: [
      { no: 'Tamamen anonim', yes: 'Takma adlı ve kriptografiyle korunuyor.' },
      { no: 'Yapay zeka seni korur', yes: 'Kalkan yardım eder, son kararı sen verirsin.' },
      { no: 'Bir insan, bir cevap', yes: 'Bir üye anahtarı, bir cevap. İnsan olduğunu kanıtlamaz.' },
      { no: 'Zamanlamadan iz sürülemez', yes: 'Cevap verdiğin an ipucu olabilir. İlk cevaplayan olma.' },
      { no: 'Denetlendi', yes: 'Henüz denetlenmedi. Kod açık.' },
    ],
  },
  end: {
    title: 'Bir ekibin en çok duyması gereken şey, kimsenin söylemediği şeydir.',
    status: "Sözleşme Midnight Preprod'a kuruluyor",
    code: 'Kodu incele',
    foot: "MIT lisanslı · sözleşme, kalkan, komut satırı aracı ve aktarıcı v2 dalında",
  },
};

const en: typeof tr = {
  tag: 'on Midnight',
  nav: { lang: 'TR', code: 'Code' },
  chapters: ['The question', 'The price', 'Anonymous forms', 'How it works', 'Who sees what', 'Check it yourself', 'What we do not claim', 'Last word'],
  hero: {
    title: ['Everyone thinks it.', 'Nobody says it.'],
    sub: 'On Stele, members of a team, community or organisation answer questions in their own words. Every answer is proven to come from a real member, nobody can tell who wrote it, and no answer can be quietly deleted.',
    scroll: 'Scroll',
    said: "I'm fine.",
    thoughts: [
      "I'm leaving in spring.",
      'My manager is the problem.',
      "I'm burned out.",
      "I don't believe the plan.",
      "I saw something. I didn't say.",
      "No raise in two years.",
      "I'm actually fine.",
      'Nobody listens.',
      "I'm interviewing.",
      "I'm scared to say it.",
      'The reorg was a mistake.',
      'I want to stay. Fix this.',
    ],
    beat1: 'People say what is safe to say, not what they think.',
    beat2: 'One of them is you.',
    you: 'What would you say if nobody knew it was you?',
  },
  cost: {
    title: 'An honest answer has a price.',
    body: 'The economist Timur Kuran calls it preference falsification. Where honesty costs something, people go quiet or say what everyone wants to hear, and whoever asked makes decisions on those answers.',
    rows: [
      { k: 'Power', line: 'Your manager will read it.', q: 'Would you leave in the next six months?' },
      { k: 'Stigma', line: 'It will stick to your name.', q: 'Has your mental health been hard this year?' },
      { k: 'The room', line: 'Everyone already said yes.', q: 'Do you actually believe in the plan we voted for?' },
      { k: 'Complicity', line: 'You were there too.', q: 'Have you seen something here that should have been reported?' },
    ],
    after: 'So everyone says "I\'m fine" again.',
  },
  anon: {
    title: 'An anonymous form does not protect you either.',
    points: [
      'Whoever runs the form sees the answers and who gave them.',
      'Your writing gives you away. Language models find the author of a text in their top five guesses 74% of the time.',
    ],
    cite: 'arXiv 2601.12407',
    fix: 'Stele fixes the first with Midnight and the second with a writing shield.',
    before: 'honestly bro pay hasnt moved in 2 yrs… mgmt never listens 🙄',
    tells: ['honestly bro', '2 yrs', 'mgmt', '🙄'],
    after: 'Pay has not increased in a long time, and management does not listen.',
    beforeLabel: 'Draft',
    afterLabel: 'After the shield',
    names: ['Alex', 'Sam', 'Priya', 'Diego', 'Mia', 'Tom', 'Lena', 'Omar', 'Kate', 'Leo', 'Nora', 'Ben', 'Yuki', 'Ravi', 'Ana', 'Jon'],
  },
  how: {
    steps: [
      {
        title: 'The rules come first. Then nobody can change them.',
        body: 'Who answers, who reads, how many answers are needed and what the asker promises are written into the contract when the question opens.',
        note: 'rules hash in the contract',
      },
      {
        title: 'You prove you are a member, not which one.',
        body: "Every member holds a key. A zero-knowledge proof says this person is one of three members, and nothing about which. Midnight's compiler will not even build code that leaks the secret.",
        note: 'membership proof',
      },
      {
        title: 'A shield reads your answer before you send it.',
        body: 'Your draft goes encrypted to a NEAR AI enclave. The shield marks what could point to you: a name, a place, a role. You decide what changes.',
        note: 'enclave signature verified',
      },
      {
        title: 'Everyone gets one answer.',
        body: 'A one-time stamp blocks a second answer. You can change yours until the deadline and the last one counts. The text is padded to a fixed size, sealed, and only its fingerprint goes on chain.',
        note: 'padded · sealed · fingerprinted',
      },
      {
        title: 'Nothing opens early. Nothing disappears quietly.',
        body: 'Answers stay locked until the deadline and until at least three came in. A moderator can remove an insult, but everyone sees that it was removed and why.',
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
    realRun: 'Real run · local devnet · 17 Nov · translated from Turkish',
    locked: 'locked until the deadline and 3 answers',
  },
  sees: {
    title: 'Nobody sees the text and the writer together.',
    body: 'Each party sees just enough to do its job. There is no single place where the words meet the name.',
    cols: ['sees', 'cannot see'],
    rows: [
      { who: 'Midnight', sees: 'that a member answered, a fingerprint, the counts', never: 'who answered or what they wrote' },
      { who: 'The shield', sees: 'the draft, for a few seconds, inside the enclave', never: 'who wrote it; nothing is logged' },
      { who: 'The asker', sees: 'every answer, once the deadline passes', never: 'which member wrote which answer' },
      { who: 'The relay', sees: 'encrypted bytes', never: 'the text or the writer' },
    ],
  },
  verify: {
    title: "Don't trust this page. Check it yourself.",
    body: 'One command compares the rules, the counts and every stored answer with what the contract holds. Anyone can run it.',
  },
  limits: {
    title: 'We only promise what we can keep.',
    body: 'The biggest risk in a privacy product is promising too much.',
    rows: [
      { no: 'Fully anonymous', yes: 'Pseudonymous, protected by cryptography.' },
      { no: 'The AI keeps you safe', yes: 'The shield helps. You make the final call.' },
      { no: 'One human, one answer', yes: 'One member key, one answer. It does not prove you are human.' },
      { no: 'Timing leaves no trace', yes: 'When you answer can be a clue. Do not be the first to answer.' },
      { no: 'Audited', yes: 'Not audited yet. The code is open.' },
    ],
  },
  end: {
    title: 'What a team most needs to hear is what nobody is saying.',
    status: 'Contract deploying to Midnight Preprod',
    code: 'Read the code',
    foot: 'MIT licensed · contract, shield, CLI and relay on the v2 branch',
  },
};

export const copy: Record<Lang, typeof tr> = { en, tr };
export type Copy = typeof tr;
