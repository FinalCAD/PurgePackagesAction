/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 371:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 953:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(371);
const github = __nccwpck_require__(953);

const githubToken = process.env.GITHUB_TOKEN;
const ghClient = new github.getOctokit(githubToken);


const getPackages = async (owner, repo) => {
    let edges = await ghClient.graphql(`{
        repository(owner: "${owner}", name:"${repo}"){
            packages(first: 100, packageType: NUGET) {
                edges {
                  node {
                    id
                    name
                    packageType
                  }
                }
              }
        }
    }`, {});
    edges = edges.repository.packages.edges;
    return edges.map(p => {
        return p.node.name;
    });
}

const getVersions = async (owner, repo, package) => {
    let edges = await ghClient.graphql(`{
        repository(owner: "${owner}", name: "${repo}") {
            packages(first: 1, packageType: NUGET, names: "${package}") {
              edges {
                node {
                  versions(first: 100) {
                    totalCount
                    nodes {
                      id
                      version
                    }
                  }
                }
              }
            }
          }
    }`, {});
    edges = edges.repository.packages.edges;
    return edges[0].node.versions.nodes.map(v => {
        return {
            id: v.id,
            version: v.version
        };
    });
}

const deletePackage = async (version) => {
    return new Promise((resolve, reject) => {
        fetch(
            'https://api.github.com/graphql',
            {
                method: 'post',
                body: JSON.stringify({query: `mutation { deletePackageVersion(input:{packageVersionId:\"${version.id}\"}) { success }}`}),
                headers: {
                    'Accept': 'application/vnd.github.package-deletes-preview+json',
                    'Authorization': `bearer ${githubToken}`
                },
            })
            .then(res => res.json())
            .then(json => {
                core.debug(JSON.stringify(json));
                resolve(json);
            })
            .catch(error => {
                core.setFailed(`failed to delete ${JSON.stringify(version)}: ${JSON.stringify(error.message)}`);
                reject();
            });
    })

};

const filterBy = (wildcard, str) => new RegExp('^' + wildcard.replace(/\*/g, '.*') + '$').test(str);

const run = async () => {
    const context = await github.context;
    let owner = context.payload.repository.full_name.split('/')[0];
    let repo = context.payload.repository.full_name.split('/')[1];

    var packages = await getPackages(owner, repo);
    versionToBeRemoved = [];
    for (const package of packages) {
        var versions = await getVersions(owner, repo, package);
        preVersions = versions.filter(x => filterBy('*-*', x.version));
        versionFinders = preVersions.map(p => p.version.split('-')[0])
                                    .filter((value, index, self) => self.indexOf(value) === index);
        for (const version of versionFinders) {
            if (versions.some(p => p.version === version)) {
                v = preVersions.filter(x => x.version.startsWith(version));
                for (const d of v) {
                    if (process.env.CI === 'true') {
                        await deletePackage(d);
                    } else {
                        console.log(d);
                    }
                }
                versionToBeRemoved = versionToBeRemoved.concat(v.map(o => {
                    return `${package}:${o.version}`;
                }));
            }
        }
    }
    core.setOutput('packagesDeleted', versionToBeRemoved.join(','));
}

try {
    run();
} catch (error) {
    core.setFailed(error.message);
}
})();

module.exports = __webpack_exports__;
/******/ })()
;