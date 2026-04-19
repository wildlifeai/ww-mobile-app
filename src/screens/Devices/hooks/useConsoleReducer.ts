import { ConsoleEntry } from '../../../components/BleConsoleOutput';

export interface ConsoleState {
    inputText: string;
    consoleHistory: ConsoleEntry[];
    isConnecting: boolean;
    isHelpVisible: boolean;
    isFlowsVisible: boolean;
    showPreviewModal: boolean;
}

export type ConsoleAction =
    | { type: 'SET_INPUT_TEXT'; payload: string }
    | { type: 'SET_IS_CONNECTING'; payload: boolean }
    | { type: 'SET_IS_HELP_VISIBLE'; payload: boolean }
    | { type: 'SET_IS_FLOWS_VISIBLE'; payload: boolean }
    | { type: 'SET_SHOW_PREVIEW_MODAL'; payload: boolean }
    | { type: 'CLEAR_HISTORY' }
    | { type: 'APPEND_HISTORY'; payload: ConsoleEntry | ConsoleEntry[] }
    | { type: 'APPEND_LOGS_AND_AUTOMATION'; payload: { newEntries: ConsoleEntry[], isWaitingForCapture: boolean } };


export const initialConsoleState: ConsoleState = {
    inputText: '',
    consoleHistory: [],
    isConnecting: false,
    isHelpVisible: false,
    isFlowsVisible: false,
    showPreviewModal: false,
};

export const consoleReducer = (state: ConsoleState, action: ConsoleAction): ConsoleState => {
    switch (action.type) {
        case 'SET_INPUT_TEXT':
            return { ...state, inputText: action.payload };
        
        case 'SET_IS_CONNECTING':
            return { ...state, isConnecting: action.payload };
        
        case 'SET_IS_HELP_VISIBLE':
            return { ...state, isHelpVisible: action.payload };
        
        case 'SET_IS_FLOWS_VISIBLE':
            return { ...state, isFlowsVisible: action.payload };
            
        case 'SET_SHOW_PREVIEW_MODAL':
            return { ...state, showPreviewModal: action.payload };
            
        case 'CLEAR_HISTORY':
            return { ...state, consoleHistory: [] };
            
        case 'APPEND_HISTORY': {
            const items = Array.isArray(action.payload) ? action.payload : [action.payload];
            return { ...state, consoleHistory: [...state.consoleHistory, ...items] };
        }
        
        case 'APPEND_LOGS_AND_AUTOMATION': {
            const { newEntries, isWaitingForCapture } = action.payload;
            const combinedNewLogs = newEntries.map(e => e.content).join('\n');
            let historyToAdd = [...newEntries];

            if (isWaitingForCapture) {
                if (combinedNewLogs.includes("Waking it")) {
                    historyToAdd.push({
                        id: Date.now().toString() + '-wake',
                        timestamp: new Date(),
                        type: 'info',
                        content: 'Device waking up... Waiting for firmware to auto-send.'
                    });
                }
                if (combinedNewLogs.includes("Discarding message")) {
                    historyToAdd.push({
                        id: Date.now().toString() + '-discard',
                        timestamp: new Date(),
                        type: 'info',
                        content: 'Command queued. Waiting...'
                    });
                }
            }
            
            // Deduplicate the automation logs if the last log is already exactly the same
            const lastLogContent = state.consoleHistory.length > 0 ? state.consoleHistory[state.consoleHistory.length - 1].content : null;

            // Only append the new entries. Filter out the specific automation logs if they exactly match the last one.
            const uniqueHistoryToAdd = historyToAdd.filter(entry => {
                if ((entry.content === 'Device waking up... Waiting for firmware to auto-send.' || entry.content === 'Command queued. Waiting...') && entry.content === lastLogContent) {
                    return false;
                }
                return true;
            });

            return {
                ...state,
                consoleHistory: [...state.consoleHistory, ...uniqueHistoryToAdd]
            };
        }

        default:
            return state;
    }
};
