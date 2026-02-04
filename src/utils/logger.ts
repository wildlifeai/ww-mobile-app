/**
 * Logger utility for the application
 * Automatically disables logs in production using __DEV__
 */

export const log = (...args: any[]) => {
	if (__DEV__) {
		console.log(...args)
	}
}

export const logError = (...args: any[]) => {
	if (__DEV__) {
		console.error(...args)
	}
}

export const logWarn = (...args: any[]) => {
	if (__DEV__) {
		console.warn(...args)
	}
}

export const logInfo = (...args: any[]) => {
	if (__DEV__) {
		console.info(...args)
	}
}

export const guard = async <T>(func: () => Promise<T> | T, type: "error" | "log" = "log"): Promise<T | Error> => {
	try {
		return await func()
	} catch (error: any) {
		if (type === "error") {
			logError(error)
		} else {
			log(error)
		}
		return error
	}
}
