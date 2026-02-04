export const logError = (error: Error | string) => {
	if (typeof error === "string") {
		__DEV__ && console.error(error)
		return
	}
	__DEV__ && console.error(error.message)
}

export const log = (text: Error | string) => {
	if (typeof text === "string") {
		__DEV__ && console.log(text)
		return
	}
	__DEV__ && console.log(text.message)
}

export const guard = async (func: Function, type: "error" | "log" = "log") => {
	try {
		return await func()
	} catch (error: any) {
		if (type === "error") {
			logError(error)
			return error
		}
		log(error)
		return error
	}
}
