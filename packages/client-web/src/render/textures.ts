import * as THREE from 'three';

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Donkey-Kong style red girder with a truss pattern and rivets. */
export function girderTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#8e1b1b';
    ctx.fillRect(0, 0, 256, 7);
    ctx.fillRect(0, 57, 256, 7);
    ctx.strokeStyle = '#ff7961';
    ctx.lineWidth = 5;
    for (let x = -64; x < 320; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 57);
      ctx.lineTo(x + 32, 7);
      ctx.lineTo(x + 64, 57);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffcdd2';
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x, 3.5, 2.2, 0, Math.PI * 2);
      ctx.arc(x, 60.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function deckTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#e57373';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 60, 128, 8);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function brickTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#8d6e63';
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 === 0 ? 0 : 16;
      for (let col = -1; col < 5; col++) ctx.fillRect(col * 32 + offset + 2, row * 16 + 2, 28, 12);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function hazardTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(64, 16, (ctx) => {
    ctx.fillStyle = '#fdd835';
    ctx.fillRect(0, 0, 64, 16);
    ctx.fillStyle = '#212121';
    for (let x = -16; x < 64; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x + 8, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 8, 16);
      ctx.fill();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function barrelTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(128, 64, (ctx) => {
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#6d3f16';
    for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 2, 64);
    ctx.fillStyle = '#37474f';
    ctx.fillRect(0, 10, 128, 7);
    ctx.fillRect(0, 47, 128, 7);
  });
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function itemBoxTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 128, 128);
    gradient.addColorStop(0, '#ffeb3b');
    gradient.addColorStop(0.5, '#ff9800');
    gradient.addColorStop(1, '#e91e63');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 116, 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 64, 70);
  });
}

export function starTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#ffee58';
    ctx.strokeStyle = '#f57f17';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 28 : 12;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

export function skyTexture(): THREE.CanvasTexture {
  return canvasTexture(8, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#0d1b4c');
    gradient.addColorStop(0.55, '#3949ab');
    gradient.addColorStop(1, '#ff8a65');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 256);
  });
}

/** Text label sprite texture; returns the texture and its aspect ratio. */
export function labelTexture(
  text: string,
  color: string,
  subtitle?: string,
): { texture: THREE.CanvasTexture; aspect: number } {
  const width = 512;
  const height = subtitle ? 160 : 112;
  const texture = canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = 'rgba(10, 12, 28, 0.78)';
    const r = 28;
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, height - 8, r);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText(text, width / 2, subtitle ? 58 : height / 2 + 2, width - 40);
    if (subtitle) {
      ctx.font = '600 38px system-ui, sans-serif';
      ctx.fillStyle = '#e0e0e0';
      ctx.fillText(subtitle, width / 2, 118, width - 40);
    }
  });
  return { texture, aspect: width / height };
}

export function speechBubbleTexture(text: string): THREE.CanvasTexture {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 90, 30);
    ctx.moveTo(110, 96);
    ctx.lineTo(128, 124);
    ctx.lineTo(146, 96);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d81b60';
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 54);
  });
}
