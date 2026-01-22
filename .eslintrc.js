module.exports = {
	root: true,
	extends: ["@react-native", "prettier", "plugin:react/jsx-runtime"],
	env: {
		jest: true,
	},
	globals: {
		device: "readonly",
		element: "readonly",
		by: "readonly",
		waitFor: "readonly",
	},
}
