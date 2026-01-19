# Setting up a Local Development Environment

Before you can contribute to Tachi, it'll help to have a functional setup on your machine.

You don't _necessarily_ need to have a working install to contribute - you could easily
make documentation contributions without having anything running on your machine - but
it's extremely helpful to be able to run Tachi's things while working on them.

## 0. Install the basics

### VSCode

We'll need a code editor so we can actually edit Tachi's code.

Please install [VSCode](https://code.visualstudio.com).
We'll use this as our editor because of it's excellent support for dev containers.

### Terminal

You'll also need a terminal to run commands in. For Linux and Mac users, you can just open
a Terminal app.

However, for Windows users we recommend installing the [Windows Terminal](https://apps.microsoft.com/store/detail/windows-terminal/9N0DX20HK701?hl=en-gb&gl=GB).

With a terminal open you can proceed to the next steps!

### Git

You'll need `git` to clone Tachi to your machine.

=== "Windows"
Install git [from the official website](https://git-scm.com/downloads).

=== "Ubuntu, Debian"
Open a terminal and type this:
`sh
	sudo apt install git
	`

=== "Arch, Manjaro"
Open a terminal and type this:

    ```sh
    sudo pacman -S git
    ```

=== "MacOS"
Open a terminal and type this:

    ```sh
    brew install git
    ```

## 1. Getting Docker.

To set everything else up for local development, we'll use [Docker](https://docker.com).

=== "Windows, WSL Ubuntu"
You should install [Docker Desktop](https://docs.docker.com/desktop/) instead.
Docker doesn't work well inside WSL.

=== "Debian"
[Please use the official Docker install guide.](https://docs.docker.com/engine/install/debian/)

=== "Ubuntu"
[Please use the official Docker install guide.](https://docs.docker.com/engine/install/ubuntu/)

=== "Arch, Manjaro"
Open a terminal and type this:

    ```sh
    sudo pacman -S docker docker-compose
    ```

=== "MacOS"
Open a terminal and type this:

    ```sh
    brew install docker docker-compose
    ```

!!! info
Docker is like a VM[^1]. It runs an entire Linux box to contain your software in, and generally sidesteps the whole "works on some machines" problem.

## 2. Fork and pull the repo.

Since you can't just commit straight to someone else's codebase (that would be a massive security issue), you need to make a fork of Tachi - One owned by you!

Go to [the Tachi repository](https://github.com/zkldi/Tachi) and click the Fork button in the top right (Make sure you're signed in).

Now, back to the terminal:

!!! tip
It's good organisation to make a folder on your PC for codestuffs.
If you do that, make sure you open the terminal in that folder,
so your Tachi repo will save there!

Open a terminal and type the following commands:

```sh
# This will create a folder called Tachi on your PC.
# It'll create it wherever your terminal is currently open in.
git clone https://github.com/YOUR_GITHUB_USERNAME/Tachi

# Open this repository in VSCode!
code Tachi
```

## 3. Get into the container.

### What is a container?

Your personal machine could be running anything. Windows, Mac, Linux, whatever!
Tachi expects to be running on Linux and with specific versions of certain software running.
It's a huge pain to ask _you_ to install that software and manage it yourself.
Plus, subtle differences between Windows and Linux cause problems _all_ the time.

As such, we work _inside_ a docker container. This is sort of like having a Linux VM with everything set up perfectly for you.
I've spent quite a bit of time making this container user friendly, and it has so many nice things pre-installed for you.

Perhaps more importantly, the container has everything needed to run Tachi perfectly. Neat!

### Getting into it

With `VSCode` open to Tachi, install the [Dev Container](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension.

Then, hit `Ctrl+Shift+P` to view all commands, and run `Dev Containers: Rebuild and Reopen in Container`.

!!! warning
First time setup can take a very long time.
This depends on the performance of your machine, and whether you're using Windows or not.

    You can click `view log` in the bottom right to see the progress of making the container.

### Working in the container

**You want to do ALL your work inside the container.**
Doing thing outside of the container will cause issues or crashes.

There is a subtle confusing trick here. We now want to use a terminal _inside_ our container.
**Do not use a terminal outside of VSCode now.**

To open a terminal inside `VSCode`, use `Ctrl+J` to open the bottom panel.
Inside there there should be a `TERMINAL` tab, click that.
There should be a `+` at the top right of the panel. Click that to open a new terminal!

You should see a message starting with `Welcome to Tachi!`. Inside this shell, you have full access to Tachi and all of its utilities.

## 4. Authenticate with Github.

You'll need to authenticate with GitHub before you can actually push changes back
to your repository.

Type `gh auth login` and follow the instructions.
You should now be properly authenticated!

## 5. Start Tachi!

With a terminal open inside the `Tachi` container you just cloned, run `just start`.

The frontend will be running on `http://127.0.0.1:3000`.
The backend will be running on `https://127.0.0.1:8080`.

!!! danger
The backend **always runs on HTTPS** in local development. This is because browsers
tend to _really_ hate HTTP mode nowadays, and it causes so many problems.

    You **need** to navigate to your running instance of the backend in a browser, and tell
    the browser that you trust these certificates. Otherwise, all client requests to
    the server will silently be chomped by the browser.

!!! tip
Type `just` in the terminal to see other available commands.

Navigate to http://127.0.0.1:3000 and check your Tachi instance!

## 6. OK, Now what.

Now that you've got a working version of Tachi running on your local PC, you should go check out the [component-specific contribution guides](./components.md)!

[^1]: Docker is not actually a VM, it's significantly smarter and does some Linux jail cgroup nonsense. All you need to care about is that we're using it to spawn Linux VMs on your host system.
