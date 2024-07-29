module.exports = {
    forbidden: [
        {
            name: 'no-unwanted-files',
            comment: 'Exclude unwanted files from the graph',
            severity: 'ignore',
            from: {},
            to: {
                path: 'node_modules|tests|docs|examples',
            },
        },
    ],
    options: {
        moduleSystems: ['es6', 'cjs'],
        exclude: {
            path: 'node_modules|tests|docs|examples',
        },
    },
};
