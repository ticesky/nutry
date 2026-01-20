import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

interface StatusProps {
    status: 'ok' | 'pending';
}

const Icon = styled.div<StatusProps>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${({status}) => (status === 'ok' ? '#28c840' : '#febc2e')};
`;

export default function WorkerStatus() {
    const [status, setStatus] = useState<StatusProps['status']>('pending');
    useEffect(
        () => {
            const worker = new Worker(new URL('./Worker.ts', import.meta.url), { type: 'module' });
            worker.addEventListener('message', e => setStatus(e.data));
            worker.postMessage('ready');

            return () => {
                worker.terminate();
            };
        },
        []
    );

    return <Icon id="worker-status" data-stauts={status} status={status} />;
}
