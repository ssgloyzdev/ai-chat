<div align="center">

![Header Banner](https://capsule-render.vercel.app/api?type=waving&color=0:000000,100:1c1c1e&height=220&section=header&text=AI%20Chat%20Application&fontSize=42&fontColor=ffffff&animation=fadeIn)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

*Aplikasi Obrolan Kecerdasan Buatan berbasis antarmuka modern, cepat, dan responsif.*

---

</div>

## 🛠️ Arsitektur Aplikasi

```mermaid
graph TD;
    A[Pengguna] -->|Mengirim Pesan| B(Frontend Interface);
    B -->|API Request| C{Backend AI Engine};
    C -->|Proses Query| D[Model LLM];
    D -->|Respon Balasan| B;
