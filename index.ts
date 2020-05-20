import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as io from '@actions/io'
import * as ioUtil from '@actions/io/lib/io-util'

const DEFAULT_DEPLOY_BRANCH = 'master'

async function run(): Promise<void> {
  try {
    let deployBranch = core.getInput('deploy-branch')
    if (!deployBranch) deployBranch = DEFAULT_DEPLOY_BRANCH

    if (github.context.ref === `refs/heads/${deployBranch}`) {
      console.log(`Triggered by branch used to deploy: ${github.context.ref}.`)
      console.log('Nothing to deploy.')
      return
    }

    const pkgManager = (await ioUtil.exists('./yarn.lock')) ? 'yarn' : 'npm'
    console.log(`Installing your site's dependencies using ${pkgManager}.`)
    await exec.exec(`${pkgManager} install`)
    console.log('Finished installing dependencies.')

    let gatsbyArgs = core.getInput('gatsby-args').split(/\s+/).filter(Boolean)
    if (gatsbyArgs.length > 0) {
      gatsbyArgs = ['--', ...gatsbyArgs]
    }

    console.log('Ready to build your Gatsby site!')
    console.log(`Building with: ${pkgManager} run build ${gatsbyArgs.join(' ')}`)
    await exec.exec(`${pkgManager} run build`, gatsbyArgs)
    console.log('Finished building your site.')

    const cnameExists = await ioUtil.exists('./CNAME')
    if (cnameExists) {
      console.log('Copying CNAME over.')
      await io.cp('./CNAME', './public/CNAME', {force: true})
      console.log('Finished copying CNAME.')
    }

    const skipPublish = (core.getInput('skip-publish') || 'false').toUpperCase()
    if (skipPublish === 'TRUE') {
      console.log('Builing completed successfully - skipping publish')
      return
    }

    const deployRepo = core.getInput('deploy-repo')
    const repo = `${github.context.repo.owner}/${deployRepo || github.context.repo.repo}`
    const repoURL = `https://${accessToken}@github.com/${repo}.git`
    console.log('Ready to deploy your new shiny site!')
    console.log(`Deploying to repo: ${repo} and branch: ${deployBranch}`)
    console.log('You can configure the deploy branch by setting the `deploy-branch` input for this action.')

    await exec.exec(`npm i -g netlify-cli`)
    await exec.exec(`netlify deploy`)

    console.log('Finished deploying your site.')

    console.log('Enjoy! ✨')
  } catch (err) {
    core.setFailed(err.message)
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}

export default run
