# **Automated Token Swapper for 0G-Newton-Testnet**  

## **Overview**  
Bot ini dirancang untuk melakukan swap token secara otomatis di jaringan **0G-Newton-Testnet** menggunakan **Uniswap V3**. Bot akan mencari token yang tersedia dalam dompet, menentukan pasangan trading yang sesuai, dan mengeksekusi swap dengan jumlah dan jeda waktu yang dapat disesuaikan.  

## **Fitur Utama**  
âœ… **Deteksi Saldo Otomatis** â€“ Menganalisis token yang tersedia untuk swap.  
âœ… **Pemilihan Pasangan Token Cerdas** â€“ Memilih pasangan perdagangan yang optimal.  
âœ… **Swap Token Acak** â€“ Menentukan jumlah swap berdasarkan persentase saldo.  
âœ… **Optimasi Biaya Gas** â€“ Menggunakan Uniswap Router dengan fee terbaik.  
âœ… **Eksekusi Transaksi Berulang** â€“ Menjalankan transaksi dengan jumlah dan interval waktu tertentu.  

## **Instalasi & Konfigurasi**  

### **1. Clone Repository**  
\`\`\`sh
git clone https://github.com/nubizen/0gAi-Auto-Tx.git
cd repo-name
\`\`\`

### **2. Instal Dependensi**  
\`\`\`sh
npm install
\`\`\`

### **3. Konfigurasi Environment**  
Buat file **\`.env\`** dan isi dengan informasi berikut:  
\`\`\`env
WALLET_PRIVATE_KEY=
SWAP_DELAY=60
MIN_BALANCE_FOR_SWAP=0.1

\`\`\`
> âš  **Penting:** Jangan pernah membagikan private key Anda!  

### **4. Jalankan Bot**  
\`\`\`sh
node index.js
\`\`\`

## **Cara Kerja**  
1. Bot membaca private key dari \`.env\` dan menghubungkan dompet ke jaringan.  
2. Mengecek saldo token dan menentukan token yang bisa ditukar.  
3. Memilih pasangan token dari daftar yang tersedia.  
4. Menghitung jumlah swap berdasarkan persentase tertentu dari saldo.  
5. Mengeksekusi transaksi swap menggunakan Uniswap Router.  
6. Mengulangi proses sesuai dengan jumlah yang telah ditentukan.  

## **Troubleshooting**  

### **1. Private Key Tidak Valid**  
- Pastikan format private key benar di file \`.env\`.  
- Jangan gunakan private key dengan spasi atau karakter tambahan.  

### **2. Swap Gagal Dilakukan**  
- Periksa saldo token dan pastikan cukup untuk swap.  
- Cek apakah pasangan token tersedia di Uniswap V3.  

### **3. Gas Price Tidak Bisa Diambil**  
- Bisa jadi jaringan sibuk, coba jalankan ulang.  
- Pastikan **RPC_URL** valid dan terhubung ke jaringan 0G-Newton-Testnet.  

## **Referensi**  
- [Uniswap V3 Docs](https://docs.uniswap.org/)  
- [0G-Newton-Testnet Explorer](https://example.com/)  

## **Lisensi**  
Proyek ini dilisensikan di bawah **MIT License**. Anda bebas menggunakannya untuk tujuan edukasi dan pengembangan lebih lanjut.  

---

**Kontak & Dukungan**  
Jika mengalami kendala atau ingin berkontribusi, silakan buat **issue** di repository ini atau hubungi saya langsung.

[Telegram](https://t.me/GrownAirdrop)
