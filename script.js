const WA = "62895360411714"; // ganti dengan nomor WhatsApp Anda
function kirimWA(teks){
  const url = `https://api.whatsapp.com/send?phone=${WA}&text=${encodeURIComponent(teks)}`;
  const w = window.open(url, "_blank");
  if(!w) window.location.href = url; // jika popup diblokir
}
const rp = n => "Rp " + n.toLocaleString("id-ID");

const MENU = [
  {id:1,nama:"Ayam bakar kecap",kat:"Makanan Utama",harga:16000,emoji:"🍛",img:"ayam-bakar.jpg",desc:"ayam yg di ungkep dengan bumbu rempah dan kecap."},
  {id:2,nama:"Ayam goreng kremes",kat:"Makanan Utama",harga:16000,emoji:"🥘",img:"ayam-kremes.jpg",desc:"ayam goreng bumbu kuning dilengkapi dengan kremesan sagu dan tepung beras."},
  {id:3,nama:"Soto betawi",kat:"Makanan Utama",harga:25000,emoji:"🍲",img:"soto-betawi.jpg",desc:"soto kuah santan dan susu dengan isian daging sapi"},
  {id:4,nama:"nasi bakar ayam suwir pedas",kat:"Makanan Utama",harga:12000,emoji:"🍲",img:"nasi-bakar.jpg",desc:"nasi gurih yang diisi dengan isian suwiran ayam yang dibungkus daun pisang lalu di bakar"},

  {id:5,nama:"Urap sayur",kat:"Sayur",harga:10000,emoji:"🥗",img:"urap-sayur.jpg",desc:"sayuran yg di campur dengan kelapa parut yang dimasak dengan bumbu kencur"},
  {id:6,nama:"Sayur Asem",kat:"Sayur",harga:10000,emoji:"🥬",img:"sayur-asem.jpg",desc:"Sayur kuah asam segar dengan jagung dan kacang panjang."},

  {id:7,nama:"Tahu isi pedas",kat:"Camilan",harga:3000,emoji:"🍢",img:"tahu-isi.jpg"},
  {id:8,nama:"Martabak telur daging",kat:"Camilan",harga:3000,emoji:"🥟",img:"martabak-telur.jpg"},

  {id:10,nama:"Es timun serut",kat:"Minuman",harga:15000,emoji:"🧋",img:"es-timun-serut.jpg",desc:" minuman timun yang diserut , diberi air gula dan perasan lemon "},

  {id:12,nama:"Bubur singkong",kat:"Dessert",harga:10000,emoji:"🍧",img:"bubur-singkong.jpg",desc:"bubur yang terbuat dari singkong yang di tumbuh lalu dimasak dengan gula merah, yang disiram kuah santan"},
];

const PAKET = [
  {id:"p1",nama:"Paket 20K",harga:20000,min:1,pop:false,isi:["Nasi","Ayam goreng kremes atau ayam bakar","Sambal & lalapan"]},
  {id:"p2",nama:"Paket 25K",harga:25000,min:1,pop:false,isi:["Nasi","Ayam goreng kremes atau ayam bakar","Tumisan atau tahu tempe","Sambal","Kerupuk"]},
  {id:"p3",nama:"Paket 28K",harga:28000,min:1,pop:false,isi:["Nasi","Ayam goreng kremes atau bakar","Tumisan atau tahu tempe","Sambal","Kerupuk","Buah"]},
  {id:"p4",nama:"Snack Box",harga:12000,min:1,pop:false,isi:["2 kue basah","1 gorengan"]}
];

let cart = {};   // {id: qty}
let activeCat = "Semua";

/* ---------- Pembayaran QRIS ---------- */
// Simpan gambar QRIS Anda sebagai "qris.jpeg" di folder yang sama.
const QRIS = {qr:"qris.jpeg", an:"ORYZA CATERING 7888"};
const BATAS_BAYAR = 3*60*1000; // 3 menit

/* ---------- Pesanan (database: Google Apps Script -> Gmail + Drive; admin ada di admin.html) ---------- */
// Tempel URL Web App dari Apps Script (lihat panduan). Jika kosong, pesanan hanya tersimpan di perangkat ini.
const API_URL = "https://script.google.com/macros/s/AKfycbyd0eWwqYdu0wTzbOrZKHIWbJPt43FY44SybHzRcE1CvJ-g_3cTPFYh1i_ayE7eeqeW/exec";
const STORE_KEY = "dn_orders";
let orders = [];            // pesanan milik perangkat ini (untuk alur pembayaran pelanggan)
try{ orders = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }catch(e){ orders = []; }
let payId = null;   // id pesanan yang sedang tampil di jendela pembayaran

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const STATUS = {menunggu:"Menunggu bayar", bukti:"Bukti dikirim", lunas:"Lunas", kadaluarsa:"Kedaluwarsa"};

async function api(payload){
  if(!API_URL || API_URL.startsWith("PASTE")) throw new Error("URL server belum diatur");
  // Tanpa header Content-Type agar tidak memicu preflight CORS (Apps Script tidak mendukungnya)
  const r = await fetch(API_URL, {method:"POST", body:JSON.stringify(payload)});
  const j = await r.json();
  if(!j.ok) throw new Error(j.error || "Gagal");
  return j;
}
// Kirim ulang otomatis jika sebelumnya gagal (mis. koneksi putus)
let syncing = false;
async function syncPending(){
  if(syncing) return; syncing = true;
  try{
    for(const o of orders){
      try{
        if(!o.synced){ await api({action:"create", order:o}); o.synced = true; saveOrders(); }
        if(o.status==="bukti" && o.synced && !o.buktiSynced){ await api({action:"bukti", id:o.id, kode:o.kode}); o.buktiSynced = true; saveOrders(); }
      }catch(e){ break; }
    }
  } finally { syncing = false; }
}
setInterval(syncPending, 20000);

function saveOrders(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(orders)); }catch(e){} }
function sisaWaktu(ms){
  if(ms<=0) return "00:00:00";
  const s = Math.floor(ms/1000), p = n => String(n).padStart(2,"0");
  return `${p(Math.floor(s/3600))}:${p(Math.floor(s%3600/60))}:${p(s%60)}`;
}
function cekKadaluarsa(){
  let ubah = false;
  orders.forEach(o=>{ if(o.status==="menunggu" && o.deadline && Date.now()>o.deadline){ o.status="kadaluarsa"; ubah=true; } });
  if(ubah){ saveOrders(); }
}
function buatOrder(o){
  const now = Date.now();
  const ord = {id:now, kode:"ORY-"+now.toString(36).slice(-5).toUpperCase(),
    waktu:new Date().toLocaleString("id-ID",{dateStyle:"short",timeStyle:"short"}),
    status:"menunggu", deadline:now+BATAS_BAYAR, synced:false, ...o};
  orders.unshift(ord); saveOrders(); renderBanner();
  bukaBayar(ord.id);
  syncPending();
}

/* ---------- Jendela pembayaran (QRIS baru tampil di sini) ---------- */
function bukaBayar(id){
  payId = id;
  document.getElementById("payModal").classList.add("show");
  renderPayModal();
}
function tutupBayar(){
  payId = null;
  document.getElementById("payModal").classList.remove("show");
  renderBanner();
}
function renderPayModal(){
  const box = document.getElementById("payModalBox");
  const o = orders.find(x=>x.id===payId);
  if(!o){ tutupBayar(); return; }
  if(o.status==="kadaluarsa"){
    box.innerHTML = `<h3>⏰ Waktu pembayaran habis</h3>
      <p>Pesanan <b>${esc(o.kode)}</b> dibatalkan karena belum dibayar dalam 24 jam. Silakan buat pesanan baru.</p>
      <button class="btn" onclick="tutupBayar()">Tutup</button>`;
    return;
  }
  if(o.status==="bukti" || o.status==="lunas"){
    box.innerHTML = `<h3>${o.status==="lunas" ? "✅ Pembayaran lunas" : "📨 Bukti pembayaran terkirim"}</h3>
      <p>Pesanan <b>${esc(o.kode)}</b> ${o.status==="lunas" ? "sudah dikonfirmasi." : "sedang kami verifikasi. Terima kasih!"}</p>
      <button class="btn" onclick="tutupBayar()">Tutup</button>`;
    return;
  }
  box.innerHTML = `<h3>Bayar Pesanan ${esc(o.kode)}</h3>
    <div class="big">${rp(o.total)}</div>
    <div>Sisa waktu pembayaran</div>
    <div class="timer" id="payTimer">${sisaWaktu(o.deadline-Date.now())}</div>
    <div>Scan QRIS a.n. <b>${esc(QRIS.an)}</b></div>
    <img src="${QRIS.qr}" alt="QRIS" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <small style="display:none">Gambar QRIS belum ditambahkan (simpan sebagai qris.jpeg).</small>
    <button class="btn" onclick="kirimBukti(${o.id})">Saya sudah bayar – kirim bukti via WhatsApp</button>
    <button class="btn ghost" onclick="tutupBayar()">Bayar nanti</button>
    <small>Pesanan baru dianggap sah setelah dibayar. Jika belum dibayar dalam 24 jam, pesanan otomatis dibatalkan.</small>`;
}
function kirimBukti(id){
  const o = orders.find(x=>x.id===id); if(!o) return;
  if(Date.now()>o.deadline){ cekKadaluarsa(); renderPayModal(); return; }
  kirimWA([
    "*BUKTI PEMBAYARAN – "+o.kode+"*",
    `Jenis: ${o.jenis}`, `Pesanan: ${o.detail}`,
    `Nama: ${o.nama}`, `HP: ${o.hp}`, `Alamat: ${o.alamat}`,
    `Tanggal: ${o.tgl}`, `Catatan: ${o.catatan || "-"}`,
    `*Total dibayar: ${rp(o.total)} (QRIS)*`,
    "", "Bukti transfer saya lampirkan di chat ini."
  ].join("\n"));
  o.status = "bukti"; o.buktiSynced = false; delete o.deadline; saveOrders(); renderPayModal(); renderBanner(); syncPending();
}
function renderBanner(){
  const el = document.getElementById("payBanner");
  const o = orders.find(x=>x.status==="menunggu");
  if(!el) return;
  if(!o){ el.classList.remove("show"); el.innerHTML=""; return; }
  el.classList.add("show");
  el.innerHTML = `<span>⏳ Pesanan <b>${esc(o.kode)}</b> menunggu pembayaran · sisa <b id="bannerTimer">${sisaWaktu(o.deadline-Date.now())}</b></span>
    <button class="btn" onclick="bukaBayar(${o.id})">Bayar Sekarang</button>`;
}
setInterval(()=>{
  const before = orders.map(o=>o.status).join();
  cekKadaluarsa();
  if(orders.map(o=>o.status).join()!==before){ renderBanner(); if(payId) renderPayModal(); }
  const o = orders.find(x=>x.id===payId);
  const t = document.getElementById("payTimer");
  if(o && t) t.textContent = sisaWaktu(o.deadline-Date.now());
  const p = orders.find(x=>x.status==="menunggu");
  const b = document.getElementById("bannerTimer");
  if(p && b) b.textContent = sisaWaktu(p.deadline-Date.now());
},1000);

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.getElementById(t.dataset.tab).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}));

/* ---------- Menu ---------- */
function renderChips(){
  const cats = ["Semua",...new Set(MENU.map(m=>m.kat))];
  const el = document.getElementById("chips");
  el.innerHTML = cats.map(c=>`<button class="chip ${c===activeCat?"active":""}" data-c="${c}">${c}</button>`).join("");
  el.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{activeCat=b.dataset.c;renderChips();renderMenu();});
}
function renderMenu(){
  const q = document.getElementById("search").value.toLowerCase().trim();
  const list = MENU.filter(m=>(activeCat==="Semua"||m.kat===activeCat)&&(m.nama.toLowerCase().includes(q)||(m.desc||"").toLowerCase().includes(q)));
  document.getElementById("menuGrid").innerHTML = list.map(m=>`
    <article class="card">
      ${m.img ? `<img class="photo" src="${m.img}" alt="${m.nama}" data-emoji="${m.emoji}" loading="lazy">` : `<div class="emoji">${m.emoji}</div>`}
      <div class="body">
        <span class="cat">${m.kat}</span>
        <h3>${m.nama}</h3>
        <p>${m.desc || ""}</p>
        <div class="row"><span class="price">${rp(m.harga)}</span>
        <button class="btn" onclick="addCart(${m.id})">+ Tambah</button></div>
      </div>
    </article>`).join("");
  document.querySelectorAll("#menuGrid img.photo").forEach(img=>{
    img.onerror = ()=>{ const d=document.createElement("div"); d.className="emoji"; d.textContent=img.dataset.emoji; img.replaceWith(d); };
  });
  document.getElementById("empty").style.display = list.length?"none":"block";
}
document.getElementById("search").addEventListener("input",renderMenu);

/* ---------- Katering ---------- */
function renderPaket(){
  document.getElementById("paketGrid").innerHTML = PAKET.map(p=>`
    <div class="paket ${p.pop?"pop":""}">
      ${p.pop?'<span class="tag">Terlaris</span>':""}
      <h3>${p.nama}</h3>
      <div class="harga">${rp(p.harga)}</div><small>per porsi · min. ${p.min} porsi</small>
      <ul>${p.isi.map(i=>`<li>${i}</li>`).join("")}</ul>
      <button class="btn ${p.pop?"":"ghost"}" onclick="pilihPaket('${p.id}')">Pilih Paket</button>
    </div>`).join("");
  document.getElementById("paketSelect").innerHTML = PAKET.map(p=>`<option value="${p.id}">${p.nama} – ${rp(p.harga)}</option>`).join("");
  hitungEstimasi();
}
function pilihPaket(id){
  document.getElementById("paketSelect").value = id;
  const p = PAKET.find(x=>x.id===id);
  const porsi = document.getElementById("porsi");
  if(+porsi.value < p.min) porsi.value = p.min;
  hitungEstimasi();
  document.getElementById("orderForm").scrollIntoView({behavior:"smooth"});
}
function hitungEstimasi(){
  const p = PAKET.find(x=>x.id===document.getElementById("paketSelect").value);
  const n = +document.getElementById("porsi").value||0;
  document.getElementById("estimasi").textContent = rp((p?p.harga:0)*n);
}
document.getElementById("paketSelect").addEventListener("change",hitungEstimasi);
document.getElementById("porsi").addEventListener("input",hitungEstimasi);
document.getElementById("orderForm").addEventListener("submit",e=>{
  e.preventDefault();
  const f = new FormData(e.target);
  const p = PAKET.find(x=>x.id===f.get("paket"));
  if(!p){ toast("Pilih paket dulu"); return; }
  const n = +f.get("porsi");
  if(!(n >= 1)){ toast("Jumlah porsi minimal 1"); return; }
  if(n < p.min){ toast(`Minimal ${p.min} porsi untuk ${p.nama}`); return; }
  buatOrder({jenis:"Katering", nama:f.get("nama"), alamat:f.get("alamat"), hp:f.get("hp"),
    porsi:n, tgl:f.get("tgl"), catatan:f.get("catatan"),
    detail:`${p.nama} x${n} porsi (${rp(p.harga)}/porsi)`, total:p.harga*n});
  e.target.reset(); document.getElementById("porsi").value = 1; hitungEstimasi();
});

/* ---------- Keranjang ---------- */
function addCart(id){ cart[id]=(cart[id]||0)+1; updateCart(); toast("Ditambahkan ke keranjang"); }
function changeQty(id,d){ cart[id]=(cart[id]||0)+d; if(cart[id]<=0) delete cart[id]; updateCart(); }
function updateCart(){
  const ids = Object.keys(cart);
  const count = ids.reduce((s,i)=>s+cart[i],0);
  const total = ids.reduce((s,i)=>s+cart[i]*MENU.find(m=>m.id==i).harga,0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = rp(total);
  document.getElementById("cartItems").innerHTML = ids.length ? ids.map(i=>{
    const m = MENU.find(x=>x.id==i);
    return `<div class="item"><span style="font-size:1.8rem">${m.emoji}</span>
      <div class="info"><b>${m.nama}</b><span>${rp(m.harga)}</span></div>
      <div class="qty"><button onclick="changeQty(${m.id},-1)">−</button><b>${cart[i]}</b><button onclick="changeQty(${m.id},1)">+</button></div></div>`;
  }).join("") : '<div class="empty">Keranjang masih kosong</div>';
}
const drawer = document.getElementById("drawer"), overlay = document.getElementById("overlay");
function openCart(o){ drawer.classList.toggle("show",o); overlay.classList.toggle("show",o); }
document.getElementById("cartBtn").onclick = ()=>openCart(true);
document.getElementById("closeCart").onclick = ()=>openCart(false);
overlay.onclick = ()=>openCart(false);
document.getElementById("checkout").onclick = ()=>{
  const ids = Object.keys(cart);
  if(!ids.length){ toast("Keranjang kosong"); return; }
  const v = id => document.getElementById(id).value.trim();
  const nama=v("cNama"), hp=v("cHp"), alamat=v("cAlamat"), tgl=v("cTgl"), catatan=v("cCatatan");
  if(!nama || !hp || !alamat || !tgl){ toast("Lengkapi nama, HP, alamat & tanggal"); return; }
  let total = 0, porsi = 0;
  const lines = ids.map(i=>{ const m=MENU.find(x=>x.id==i); total+=m.harga*cart[i]; porsi+=cart[i]; return `${m.nama} x${cart[i]} = ${rp(m.harga*cart[i])}`; });
  openCart(false);
  buatOrder({jenis:"Menu", nama, alamat, hp, porsi, tgl, catatan, detail:lines.join("; "), total});
  cart = {}; updateCart();
  ["cNama","cHp","cAlamat","cTgl","cCatatan"].forEach(id=>document.getElementById(id).value="");
};

/* ---------- Toast ---------- */
let tt;
function toast(t){ const el=document.getElementById("toast"); el.textContent=t; el.classList.add("show"); clearTimeout(tt); tt=setTimeout(()=>el.classList.remove("show"),1800); }

/* Init */
cekKadaluarsa();
renderChips(); renderMenu(); renderPaket(); updateCart(); renderBanner(); syncPending();