# Lab 1: Routing and Switching — Lab Report

| Field | Details |
|---|---|
| Course | Routing and Switching |
| Lecturer | Prof. Oumaima FADI |
| Teaching Assistants | Prof. Mustapha Ait Abderrahmane & Prof. Laila Fouad |
| Group Members | Student 1: [Nom] [Prénom] — Student 2: [Nom] [Prénom] |
| Matricule | Student 1: [Matricule] — Student 2: [Matricule] |
| Class / Year | [Class / Year] |
| Date | [Date] |
| Software | Cisco Packet Tracer |

---

## Objective

The goal of this lab is to set up a network between different machines and to learn how to perform the necessary network configurations. The lab covers:

- IP addressing configuration on a simple home network setup;
- Peer-to-Peer (P2P) connection configuration;
- LAN setup configuration;
- Basic network configuration using Cisco Packet Tracer.

---

## Materials / Equipment

- Cisco Packet Tracer (network simulation software)
- 3 PCs, 2 Laptops, 1 Home Router
- 2 PCs (for the P2P section)
- 4 PCs and 1 Switch (for the LAN section)
- 4 PCs, 2 Switches, 1 Router (for the basic network configuration section)
- Cross-over and Straight-through cables

---

## Section 1 — Simple Home Network Setup

### 1.1 Selection of End Devices

The following end devices were used in this section:

| Device | Type | Quantity |
|---|---|---|
| PC | End Device | 3 |
| Laptop | End Device | 2 |
| Home Router | Network Device / Wireless Device | 1 |

Steps performed:

1. From `End Devices`, 3 PCs were selected and dragged onto the workspace.
2. From `End Devices`, 2 Laptops were selected and dragged onto the workspace.
3. From `Network Devices` → `Wireless Devices`, the `Home Router` was selected and dragged onto the workspace.

### 1.2 Connecting the Devices

**Cable rule followed in this lab:**

- **Cross-over cables** are used to connect two identical devices (e.g., PC to PC).
- **Straight-through cables** are used to connect two different devices (e.g., PC to router/switch).

#### LAN (wired) connection

1. From `Connections`, the option `Automatically choose connection type` was selected.
2. Using this connection type, 2 PCs and 1 Laptop were connected to the `Home Router`.

#### Wireless connection

1. A Laptop/PC was selected and powered off.
2. The built-in LAN Ethernet card was removed.
3. A `WPC300N` wireless card was dragged onto the device to replace the Ethernet card.
4. The Laptop/PC was powered back on.

### 1.3 Results

The home network was successfully built with a mix of wired (2 PCs + 1 Laptop) and wireless (1 Laptop + 1 PC) connections to the Home Router. The wireless devices used the `WPC300N` wireless module after removing the Ethernet card.

> **Figure 1:** [INSERT SCREENSHOT — Home network topology with 3 PCs, 2 Laptops and the Home Router]

> **Figure 2:** [INSERT SCREENSHOT — Replacement of the Ethernet card by the WPC300N wireless card]

---

## Section 2 — Peer-to-Peer (P2P) Connection

### 2.1 Connecting the Devices

1. From `End Devices`, 2 PCs were selected and renamed (PC1 and PC2).
2. From `Connections`, a **Cross-over cable** was used to connect the 2 PCs on their `FastEthernet0` ports.

### 2.2 IP Configuration

The PCs were configured through `Desktop` → `IP Configuration`:

| Parameter | PC1 | PC2 |
|---|---|---|
| IPv4 Address | 192.168.1.1 | 192.168.1.2 |
| Subnet Mask | 255.255.255.0 | 255.255.255.0 |

### 2.3 Testing the Connection (PING)

1. On PC1, `Desktop` → `Command Prompt` was opened.
2. The command below was executed:

```
ping 192.168.1.2
```

The ping succeeded, which confirms that PC1 and PC2 are communicating successfully over the P2P link (they belong to the same subnet `192.168.1.0/24`).

3. To visualize the communication in real time, `Simulation` mode was selected, the ping was re-run, and the `Play` button was used to watch the ICMP packets (echo request / echo reply) travel from PC1 to PC2 and back.

> **Figure 3:** [INSERT SCREENSHOT — P2P topology: PC1 and PC2 connected with a cross-over cable]

> **Figure 4:** [INSERT SCREENSHOT — IP configuration of PC1 (192.168.1.1)]

> **Figure 5:** [INSERT SCREENSHOT — IP configuration of PC2 (192.168.1.2)]

> **Figure 6:** [INSERT SCREENSHOT — Successful ping result from PC1 to 192.168.1.2]

> **Figure 7:** [INSERT SCREENSHOT — Simulation mode showing packets between PC1 and PC2]

---

## Section 3 — LAN: Connecting Multiple PCs

### 3.1 Connecting the Devices

1. From `End Devices`, 4 PCs were selected and renamed.
2. From `Network Devices`, a **Switch** was selected.
3. All 4 PCs were connected to the switch using straight-through cables.
4. An IP address was assigned to each PC through `Desktop` → `IP Configuration`.

| Device | IPv4 Address | Subnet Mask |
|---|---|---|
| PC1 | 192.168.1.1 | 255.255.255.0 |
| PC2 | 192.168.1.2 | 255.255.255.0 |
| PC3 | 192.168.1.3 | 255.255.255.0 |
| PC4 | 192.168.1.4 | 255.255.255.0 |

### 3.2 Testing the Connection

1. The `ipconfig` / `ipconfig /all` command was used to display all the details of the PC configuration (IP address, subnet mask, MAC address, etc.).
2. The connection between PCs was verified using the ping command, e.g.:

```
ping 192.168.1.2
```

The ping was successful between PCs of the same LAN.

3. In `Simulation` mode, `Add Simple PDU (P)` was selected, dragged between two PCs, and the `Play` button was clicked to visualize the frames travelling through the switch in real time.

### 3.3 Results

All PCs in the LAN were able to communicate since they belong to the same IP network (`192.168.1.0/24`) and are connected to the same layer-2 switch. The switch forwards frames based on the MAC addresses learned from the connected hosts.

> **Figure 8:** [INSERT SCREENSHOT — LAN topology: 4 PCs connected to the switch]

> **Figure 9:** [INSERT SCREENSHOT — `ipconfig /all` output on one of the PCs]

> **Figure 10:** [INSERT SCREENSHOT — Successful ping between two PCs in the LAN]

> **Figure 11:** [INSERT SCREENSHOT — Simple PDU simulation between two PCs through the switch]

---

## Section 4 — Basic Network Configuration Using Cisco Packet Tracer

### 4.1 Selecting the Devices

1. From `End Devices`, 4 PCs were dragged onto the workspace.
2. From `Network Devices` → `Switches`, 2 Switches were dragged onto the workspace.
3. From `Network Devices` → `Routers`, 1 Router was dragged onto the workspace.

### 4.2 Connecting the Devices (PC to Switch)

1. From `Connections`, the `Copper Straight-through` cable was selected.
2. Each PC (port `FastEthernet0` / FastEthernet) was connected to Switch1/Switch2 on port `FastEthernet0/1` (and subsequent ports for the remaining PCs).

### 4.3 Connecting the Devices (Switch to Router)

1. A `Copper Straight-through` cable was used.
2. Switch1 (`GigabitEthernet0/1`) was connected to the Router on `GigabitEthernet0/0/0`.
3. Switch2 (`GigabitEthernet0/1`) was connected to the Router on `GigabitEthernet0/0/1`.

**Observation:** At first, the link indicator was **red**, which means no connection was established between the devices. The router interfaces therefore needed to be configured (assign an IP address and enable the interface) to turn the light **green**.

### 4.4 Configuration of the Router Ports

The router was configured using the CLI mode:

```
Router> no            (dismiss the initial configuration dialog)
Router> enable
Router# configure terminal
Router(config)# interface Gig0/0/0
Router(config-if)# ip address 192.168.1.1 255.255.255.0
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# interface Gig0/0/1
Router(config-if)# ip address 192.168.2.1 255.255.255.0
Router(config-if)# no shutdown
Router(config-if)# exit
```

**Result:** After closing the window, the red light changed to green, meaning that the connection was established between the switches and the router.

### 4.5 Configuration of the PCs

**PC1 and PC2 (connected to Switch1 — network 192.168.1.0/24):**

| Parameter | PC1 | PC2 |
|---|---|---|
| IP Address | 192.168.1.10 | 192.168.1.11 |
| Subnet Mask | 255.255.255.0 | 255.255.255.0 |
| Default Gateway | 192.168.1.1 | 192.168.1.1 |

**PC3 and PC4 (connected to Switch2 — network 192.168.2.0/24):**

| Parameter | PC3 | PC4 |
|---|---|---|
| IP Address | 192.168.2.10 | 192.168.2.11 |
| Subnet Mask | 255.255.255.0 | 255.255.255.0 |
| Default Gateway | 192.168.2.1 | 192.168.2.1 |

### 4.6 Confirming the Connection (PDU Test)

1. From the menu bar, `Add Simple PDU (P)` was selected and dragged from a PC toward the router. A successful delivery implies the connection was established.
2. A PDU was then dragged from PC1 (192.168.1.10) to PC3 (192.168.2.10) to verify traffic across the two networks through the router.

**Observation:** Communication across the subnets succeeded. PC1 and PC3 are in different IP networks (`192.168.1.0/24` and `192.168.2.0/24`), so their packets must transit through the router, which routes between the two subnets using its `Gig0/0/0` (192.168.1.1) and `Gig0/0/1` (192.168.2.1) interfaces.

> **Figure 12:** [INSERT SCREENSHOT — Full topology: 4 PCs, 2 switches, 1 router]

> **Figure 13:** [INSERT SCREENSHOT — Router CLI configuration (interface Gig0/0/0)]

> **Figure 14:** [INSERT SCREENSHOT — Router CLI configuration (interface Gig0/0/1)]

> **Figure 15:** [INSERT SCREENSHOT — IP configuration of PC1 (192.168.1.10, gateway 192.168.1.1)]

> **Figure 16:** [INSERT SCREENSHOT — IP configuration of PC3 (192.168.2.10, gateway 192.168.2.1)]

> **Figure 17:** [INSERT SCREENSHOT — Successful PDU from PC1 to the router]

> **Figure 18:** [INSERT SCREENSHOT — Successful PDU from PC1 to PC3 across the two networks]

---

## Conclusion

In this lab, I learned how to set up different types of networks in Cisco Packet Tracer:

1. **Simple home network** mixing wired and wireless connections with a Home Router;
2. **Peer-to-peer connection** between two PCs using a cross-over cable and manual IP addressing, verified with `ping`;
3. **LAN setup** connecting multiple PCs to a switch, verified with `ipconfig` and `ping` and visualized in simulation mode;
4. **Basic routed network** with two switches and one router, where I configured router interfaces in CLI mode and verified inter-network communication with a Simple PDU.

This lab gave me a practical understanding of IP addressing, subnet masks, default gateways, cable types (straight-through vs cross-over), and the role of switches (LAN) and routers (inter-network routing).