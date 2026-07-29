# STELE

**Bir kurum; sorusunu, kime sorduğunu, ne zaman kapatacağını ve sonuca ne yapacağını geri alamayacak biçimde kaydeder. Cevap verenler görünmez kalır; sayım ve verilen söz herkesçe doğrulanabilir.**

Stele bir anket aracı değil, bir **hesap verebilirlik sicilidir**. Anket toplama, sicili üreten mekanizmadır; ürün, sicili itiraz edilemez kılan şeydir.

Adını Hammurabi'nin stelinden alır: kanunlar taşa kazınıp meydana dikilir, halk okur, kimse silemez.

Midnight Network üzerinde Compact ile yazılmıştır.

---

## Çözdüğü problem

Geri bildirim sistemlerinde üç ayrı güven kırığı vardır:

1. **"Beni tanırlar mı?"** — misilleme korkusu. Hasta "zor hasta" damgası yememek için şikâyet etmez; öğrenci not kaygısıyla cevabını yumuşatır.
2. **"Söylesem ne değişecek, gömerler."** — kurum kötü sonucu duyurmazsa kimse anlamaz.
3. **"Açıklanan rakamlar gerçek mi?"**

Mevcut anket araçları yalnız birinciyi çözmeye çalışır ve diğer ikisini yapısal olarak çözemez: **veriyi toplayan taraf ile sonucu raporlayan taraf aynıdır.**

Stele üçünü de mimariye taşır. Kimlik zincire hiç düşmez; sayım ve kurumun sözü ise zincire kazınır, üçüncü bir taraf bunları bağımsız olarak doğrulayabilir.

---

## Ürünün atomu: TUR

Bir tur, beş taahhüdün aynı anda ve geri alınamaz biçimde kaydedilmesidir:

| Taahhüt | Ledger alanı |
|---|---|
| **Soru** (tek, kapalı uçlu) | `questionHash`, `optionCount` |
| **Kim** (uygunluk kümesi) | `eligibility` kökü, `eligibleCount` |
| **Sıra** (sicildeki yeri) | `roundNumber` |
| **Söz** (sonuca bağlı taahhüt) | `promiseHash`, `promiseThreshold` |
| **Alt sınır** (k-anonimlik) | `minParticipants` |

Dördüncüsü ürünün kalbidir. Sayımı kazımak *"söylesem ne değişecek"* sorusunu cevaplamaz; **sözü kazımak** cevaplar. Kurum turu açarken "şu eşiğin altında çıkarsa şunu yapacağım" der; bir sonraki tur açıldığında sözün tutulup tutulmadığı aynı sicilde yan yana durur.

---

## Yaşam döngüsü

```
KAYIT  ──►  OYLAMA  ──►  KAPALI
```

- **KAYIT** — katılımcılar commitment gönderir, uygunluk ağacı büyür.
- **OYLAMA** — kök **donar**, yalnız katılım kabul edilir.
- **KAPALI** — sayım kesinleşir; k-eşiğinin altındaki tur kapatılamaz.

Kökün donması üç sorunu birden çözer: kanıt üretilirken kökün değişip işlemi geçersiz kılmasını, tur ortasında hayalet katılımcı eklenmesini, ve aynı soruyu farklı kümelerle açıp farktan tek kişiyi izole etme (differencing) saldırısını.

---

## Gizlilik modeli

### Zincirde ne var (herkes görür)

Tur numarası · soru ve seçenek hash'i · uygunluk kökü · kaç kişi kaydoldu · taahhüt eşiği ve söz hash'i · faz durumu · kullanılmış tekillik damgaları · seçenek başına sayaç · toplam katılım.

### Zincire hiç düşmeyen (yalnız katılımcının cihazında)

Uygunluk sırrı · Merkle üyelik yolu · cevabın kime ait olduğu.

### Devrenin kanıtladığı

> *Uygunluk ağacındaki bir commitment'ın sırrını biliyorum **ve** bu turda damgam daha önce kullanılmadı **ve** cevabım geçerli aralıkta.*

### Gözlemci ne öğrenir, ne öğrenemez

**Öğrenir:** kaç kişi kaydoldu, kaç kişi katıldı, hangi seçenek kaç oy aldı, turun ne zaman açılıp kapandığı, kurumun ne söz verdiği.

**Öğrenemez:** kimin katıldığı, kimin ne cevap verdiği, bir damganın hangi kayda ait olduğu, aynı kişinin farklı turlardaki damgalarının ilişkisi.

### Kriptografik kurallar

- `commitment = persistentHash("stele:cm:", sır)` — **sır yalnız katılımcının cihazında üretilir.** Sırrı bilen taraf tüm damgaları önceden hesaplayabileceği için, sır merkezî olarak üretilirse ledger'daki damga listesi o taraf için isim listesine dönüşür.
- `nullifier = persistentHash("stele:nul:", turNo, sır)` — tur numarası domain ayrımına girer; aynı kişinin farklı turlardaki damgaları birbirine bağlanamaz.
- Damga **asla** commitment'tan türetilmez (commitment kurumun elindedir).
- `transientHash` ledger'a yazılan hiçbir değerde kullanılmaz — protokol yükseltmeleri arasında kalıcı değildir.
- Üyelik kanıtında **`Set` kullanılmaz**: hangi elemanın test edildiğini açığa çıkarır. Üyelik `HistoricMerkleTree` ve witness path ile kanıtlanır. Damganın "kullanıldı mı" kontrolü için `Set` güvenlidir, çünkü damga zaten public olması istenen bir değerdir.
- Üyelik doğrulaması iki koşulu birden arar: kökün tanınması **ve** yaprağın bizim commitment'ımız olması. Tek başına kök kontrolü, geçerli ama alakasız bir yaprakla geçilebilirdi.
- Kanıt **kullanıcının kendi cihazında** üretilir. Barındırılmış proof server yasaktır: witness'ı düz metin görür.

---

## Dürüst sınırlar

Bunlar gizlenmiyor, çünkü gizlendiği anda ilk ciddi incelemede çöker.

| Sınır | Gerçek |
|---|---|
| **Canlı sayaç** | Ledger public; tur sürerken sayaç akar. Küçük gruplarda zamanlama ile ilişkilendirme riski vardır — k-eşiği bu yüzden bir ürün ayarı değil, devre kuralıdır. Tam çözüm commit-reveal, v2'ye planlı. |
| **Tekillik ≠ insanlık** | Devre "sır sahibiyim ve bu turda kullanmadım"ı kanıtlar, insan olduğunu kanıtlamaz. Stele bot doldurmasını engellediğini **iddia etmez**; kapalı roster ve ödülsüz model o ekonomiyi ithal etmez. |
| **Sır = makbuz** | Sırrını paylaşan cevabını da paylaşmış olur; zorlama senaryosu çözülmemiştir. |
| **Anonimlik dili** | Hukuken "anonim" değil, **takma adlı + kriptografik korumalı**. |
| **Kayıt anı** | Kurum kimin kaydolduğunu görür (sırrı değil). Muhalifi listeye hiç almama riski protokolle çözülmez; savunma, kayıt listesinin açıklığıdır. |
| **Mobil** | Katılım akışı kanıt üretimi gerektirir; v1'de masaüstü hedeflenir. |
| **Güvence** | Bu kod **denetlenmiş değildir**. Söylenebilecek olan: açık kaynak, tekrarlanabilir derleme, gizlilik invariant testleri ve statik analiz. |

---

## Kurulum

Geliştirme Linux ve macOS'ta desteklenir. Windows'ta **WSL2** gerekir.

```bash
# Toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update            # compiler 0.31.1

# Proof server — witness cihazdan çıkmaz, yerel çalışır
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0

# Bağımlılıklar (Node >= 24)
npm install
```

## Derleme ve test

```bash
cd contract
npm run compact      # Compact -> managed/ (zkir + prover/verifier anahtarları)
npm run typecheck
npx vitest run
```

Test kümesi dört şeyi kanıtlar: turun taahhütlerinin değişmezliği, katılım mantığı ve tekillik damgası, faz makinesi kuralları, ve **gizlilik invariantı** — katılımcının sırrının hiçbir ledger alanında görünmediği.

---

## Yapı

```
stele/
├── contract/     Compact kontratı, witness katmanı, testler
├── api/          Paylaşılan tipler ve kontrat API'si
├── stele-cli/    Komut satırı istemcisi
└── stele-ui/     Web arayüzü
```

## Sürümler

| Bileşen | Sürüm |
|---|---|
| Compact compiler | 0.31.1 |
| Compact dili | 0.23 |
| Proof server | 8.1.0 |
| Midnight.js | 4.1.1 |
| DApp connector API | 4.0.1 |
| Node | >= 24 |

## Lisans

Apache-2.0
