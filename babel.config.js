module.exports = {
	presets: ["babel-preset-expo"],
	env: {
		production: {
			plugins: ["react-native-paper/babel"],
		},
	},
	plugins: [
		["@babel/plugin-proposal-decorators", { legacy: true }],
		"react-native-reanimated/plugin",
	],
}
