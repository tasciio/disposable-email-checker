import domainList from "../data/domains.txt";
import { createApp } from "./app";
import { parseDomainList } from "./domain";

const blacklist = parseDomainList(domainList);

export default createApp(blacklist);

