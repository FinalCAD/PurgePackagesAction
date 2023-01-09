const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

const githubToken = process.env.GITHUB_TOKEN;
const ghClient = new github.getOctokit(githubToken);


const getPackages = async (owner, repo) => {
    let currentCount = 0;
    let index = 1;
    let packages = []
    // use old style way because iterate doesn't work on packages...
    do {
        const response = await axios.get(`https://api.github.com/orgs/${owner}/packages?package_type=nuget&page=${index}`, { headers: {
            'Authorization': `bearer ${githubToken}`,
            'Accept': 'application/vnd.github+json'
        }});
        index = index + 1;
        currentCount = response.data.length;
        if (response.data.length >= 1) {
            packages = packages.concat(response.data.filter((element) => element.repository && element.repository.name === repo));
        }
    } while(currentCount > 0)

    console.log(`Packages found in repository ${repo}: ${packages.length}`);

    return packages;
}

const getVersions = async (owner, repo, package) => {
    const versions = await ghClient.paginate(ghClient.rest.packages.getAllPackageVersionsForPackageOwnedByOrg, {
        package_type: package.package_type,
        package_name: package.name,
        org: owner
    });
    return versions.map(v => {
        return {
            id: v.id,
            package: package,
            version: v.name
        };
    });
}

const deletePackage = async (owner, version) => {
    console.log(`Remove package ${version.package.name}:${version.version}`);
    await ghClient.rest.packages.deletePackageVersionForOrg({
        package_type: version.package.package_type,
        package_name: version.package.name,
        org: owner,
        package_version_id: version.id
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
                   await deletePackage(owner, d);
                }
                versionToBeRemoved = versionToBeRemoved.concat(v.map(o => {
                    return `${package}:${o.version}`;
                }));
            }
        }
    }
//    core.setOutput('packagesDeleted', versionToBeRemoved.join(','));
}

try {
    run();
} catch (error) {
    core.setFailed(error.message);
}