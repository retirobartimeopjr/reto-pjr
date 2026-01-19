This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# reto-pjr


ssh -i ~/.ssh/bartimeo-key.pem ubuntu@52.67.225.143
 % chmod 400 ~/.ssh/bartimeo-key.pem    



 1. En tu Mac (Local)
Primero, realiza y prueba tus cambios.

Edita el código en tu editor.
Prueba que funcione localmente: npm run dev.
Sube los cambios al servidor. Tienes dos opciones según cómo lo configuraste:
Opción A (Recomendada - Git): Si usaste git clone en el servidor.
bash
git add .
git commit -m "Descripción de tu cambio"
git push origin main
Opción B (Manual - SCP): Si copiaste los archivos manualmente.
bash
# Ejecuta esto desde la carpeta donde tienes tu archivo .pem (ej. ~/.ssh/) o ajusta la ruta
scp -i ~/.ssh/bartimeo-key.pem -r ~/Desktop/XPO/gemini/bartimeo/bartimeo-app/* ubuntu@<TU_IP_PUBLICA>:/home/ubuntu/bartimeo-req/
(Nota: Asegúrate de que la ruta de destino /home/ubuntu/bartimeo-req/ sea la correcta donde está tu app en el servidor).
2. En el Servidor AWS (Remoto)
Conéctate y aplica los cambios.

Conéctate por SSH:
bash
ssh -i ~/.ssh/bartimeo-key.pem ubuntu@<TU_IP_PUBLICA>
Ve a la carpeta del proyecto:
bash
cd bartimeo-req  # O el nombre de la carpeta donde esté tu app
Actualiza el código (Solo si usas Git):
bash
git pull origin main
Reinstala dependencias y Construye (Build): Es vital hacer el build de nuevo para que Next.js procese los cambios.
bash
npm install       # Solo necesario si agregaste nuevas librerías
npm run build     # ¡Importante! Esto genera la nueva versión de producción
Reinicia la aplicación: Dile a PM2 que reinicie el proceso para servir la nueva versión.
bash
pm2 restart bartimeo
Resumen Rápido (Cheat Sheet)
Cada vez que hagas un cambio, el ciclo en el servidor es: git pull -> npm run build -> pm2 restart bartimeo