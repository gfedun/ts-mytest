module.exports = {
  entry: './src/index.txt',
  module: {
    rules: [{test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/}]
  },
  resolve: {extensions: ['.ts', '.js']},
  output: {filename: 'bundle.js', path: __dirname + '/build'}
};
