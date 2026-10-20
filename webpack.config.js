const path = require('path');

module.exports = {
  name: 'lookbase-extension',
  entry: path.resolve(__dirname, 'src/index.tsx'),
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    modules: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../essbase/tmp/viz-report-table-marketplace2/node_modules'),
      'node_modules',
    ],
    alias: {
      'report-table-js': path.resolve(__dirname, 'viz-report-table/src/report_table.js'),
      'report-table-react': path.resolve(__dirname, 'viz-report-table/packages/report-table-react/index.tsx'),
      'report-table-extension': path.resolve(__dirname, 'viz-report-table/packages/report-table-extension'),
    },
    fallback: {
      buffer: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              '@babel/preset-react',
              '@babel/preset-typescript',
            ],
          },
        },
      },
      {
        test: /\.css$/i,
        use: [
          { loader: 'style-loader', options: { injectType: 'lazyStyleTag' } },
          'css-loader',
        ],
      },
      {
        test: /\.(woff|woff2|ttf|otf)$/,
        loader: 'url-loader',
      },
    ],
  },
  devServer: {
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    },
  },
};
