import { useEffect, useRef } from "react"

export const useInterval = (
	callback: any,
	delay: number,
	instant: boolean = false,
) => {
	const savedCallback = useRef<any>()
	const intervalRef = useRef<any>()

	useEffect(() => {
		savedCallback.current = callback
	}, [callback])

	useEffect(() => {
		function tick() {
			savedCallback.current()
		}

		instant && tick()

		if (delay !== null) {
			const id = setInterval(tick, delay)
			return () => clearInterval(id)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [delay])
}
