import { useState, useEffect, useRef } from 'react';

export const useTimer = (isActive: boolean) => {
    const [elapsedSec, setElapsedSec] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isActive) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return;
        }

        let currentSec = 0;
        setElapsedSec(0);
        timerRef.current = setInterval(() => {
            currentSec += 1;
            setElapsedSec(currentSec);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive]);

    return { elapsedSec, setElapsedSec };
};
