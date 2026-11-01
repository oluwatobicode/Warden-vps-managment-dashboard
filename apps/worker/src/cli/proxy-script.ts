import { proxySetupScript } from "../deploys/traefik";

/*
 * Prints the shell script that starts Warden's Traefik, for the server Warden
 * itself runs on (infra/production/install.sh pipes it into sh). Reads no
 * environment and touches nothing: it only prints.
 */
process.stdout.write(proxySetupScript());
