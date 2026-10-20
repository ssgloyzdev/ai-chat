<div align="center">

![Header Banner](https://capsule-render.vercel.app/api?type=waving&color=auto&height=220&section=header&text=AI%20Chat%20Application&fontSize=42&animation=fadeIn)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

*Aplikasi Obrolan Kecerdasan Buatan berbasis antarmuka modern, cepat, dan responsif.*

---

</div>

## 🚀 Fitur Utama

- **Antarmuka Ringkas**: Tampilan bersih dengan tema gelap modern.
- **Dukungan Multi-Model**: Memungkinkan pengguna memilih berbagai model AI.
- **Responsif & Cepat**: Respons percakapan real-time.

---

## 📸 Tampilan Antarmuka (UI Preview)

<table width="100%" style="background-color: #000000; color: #ffffff; border: 1px solid #222222; border-radius: 12px; font-family: Arial, sans-serif; border-collapse: separate; border-spacing: 0;">
  <tr>
    <td colspan="3" style="padding: 16px; border-bottom: 1px solid #222222; font-weight: bold; font-size: 15px;">
      ☰ &nbsp; Obrolan Baru
    </td>
  </tr>
  <tr>
    <td colspan="3" align="center" style="padding: 80px 0; color: #666666; font-size: 14px;">
      Mulai obrolan baru
    </td>
  </tr>
  <tr>
    <td style="padding: 12px; width: 1%; white-space: nowrap;">
      <div style="background-color: #121212; color: #aaaaaa; padding: 10px 14px; border-radius: 16px; font-size: 12px; border: 1px solid #2c2c2c;">
        Pilih model ▾
      </div>
    </td>
    <td style="padding: 12px; width: 98%;">
      <div style="background-color: #121212; color: #777777; padding: 10px 16px; border-radius: 20px; border: 1px solid #2c2c2c; font-size: 13px;">
        Ketik pesan...
      </div>
    </td>
    <td style="padding: 12px; width: 1%; white-space: nowrap; text-align: right;">
      <div style="background-color: #ffffff; color: #000000; width: 36px; height: 36px; border-radius: 50%; text-align: center; line-height: 36px; font-weight: bold; font-size: 14px;">
        ➔
      </div>
    </td>
  </tr>
</table>

---

## 🛠️ Arsitektur Aplikasi

```mermaid
graph TD;
    A[Pengguna] -->|Mengirim Pesan| B(Frontend Interface);
    B -->|API Request| C{Backend AI Engine};
    C -->|Proses Query| D[Model LLM];
    D -->|Respon Balasan| B;
