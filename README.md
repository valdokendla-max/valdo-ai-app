# Next.js Rakendus

See projekt on Next.js põhine veebirakendus.

## Arenduse alustamine

1. Paigalda sõltuvused:
   ```
npm install
   ```
2. Käivita arendusserver:
   ```
npm run dev
   ```

## Build ja deployment

1. Ehita projekt:
   ```
npm run build
   ```
2. Käivita production server:
   ```
npm start
   ```

## Koodistiil
- ESLint ja Prettier on seadistatud automaatseks koodi kontrolliks ja vormindamiseks.

## 404 ja 500 lehed
- Kohandatud 404 (not-found.tsx) ja üldine vealeht (error.tsx) on olemas.

## Deployment
- Soovitatav kasutada Vercel või Netlify platvormi kiireks deploymentiks.

## Pildigeneratsioon ComfyUI kaudu

Rakendus toetab nüüd pildiloomet eraldi /api/image route kaudu. Selle jaoks lisa Vercelis või lokaalsesse .env.local faili järgmised muutujad:

```env
COMFYUI_BASE_URL=http://sinu-comfyui-server:8188
COMFYUI_CHECKPOINT_NAME=flux1-dev.safetensors
COMFYUI_API_KEY=
COMFYUI_NEGATIVE_PROMPT=low quality, blurry, distorted, deformed, bad anatomy, extra fingers, watermark, text
COMFYUI_WIDTH=1024
COMFYUI_HEIGHT=1024
COMFYUI_STEPS=30
COMFYUI_CFG=4
COMFYUI_SAMPLER=euler
COMFYUI_SCHEDULER=normal
```

Märkused:
- COMFYUI_BASE_URL peab olema serverist kättesaadav ComfyUI endpoint.
- COMFYUI_CHECKPOINT_NAME peab täpselt vastama sinu ComfyUI-s olemasoleva mudelifaili nimele.
- Kui ComfyUI kasutab autentimist, lisa COMFYUI_API_KEY.
- UI-s saad pildireziimi sisse lülitada nupuga Loo pilt.
