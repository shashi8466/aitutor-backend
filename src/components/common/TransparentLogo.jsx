import React, { useRef, useEffect, useState } from 'react';

const TransparentLogo = ({ src, className }) => {
    const canvasRef = useRef(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            // High DPI support for sharp canvas
            const scale = window.devicePixelRatio || 1;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // The image has a very dark blue background. We hardcode it to avoid picking up white rounded corners.
            const bgR = 11;
            const bgG = 21;
            const bgB = 39;
            
            // Increased tolerance slightly for JPEG compression artifacts
            const tolerance = 70;
            const feather = 30;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                
                const dist = Math.sqrt(
                    Math.pow(r - bgR, 2) + 
                    Math.pow(g - bgG, 2) + 
                    Math.pow(b - bgB, 2)
                );
                
                if (dist < tolerance) {
                    data[i+3] = 0; // completely transparent
                } else if (dist < tolerance + feather) {
                    // smooth blending for edges to avoid jagged pixels
                    const alpha = Math.min(255, (dist - tolerance) * (255 / feather));
                    data[i+3] = alpha;
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            setLoaded(true);
        };
    }, [src]);

    return (
        <canvas 
            ref={canvasRef} 
            className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`} 
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
            }}
        />
    );
};

export default TransparentLogo;
