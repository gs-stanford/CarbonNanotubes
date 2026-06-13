function [ ArrayYarnVec,ArraySheetVec,ArrayLinkedVec] = ArrayYarnDatas()

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% DATA FROM CARBON NANOTUBE YARNS: REVIEW BY MENGHE MIAO AND FROM OTHER   %
% REVIEWS AS WELL ON FOREST-DRAWN MATERIALS.                 		      %
% "Yarn spun from carbon nanotube forests: Production, structure,         %
% properties and applications". Particuology 11 (2013) pp. 378-393.       %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

ArrayYarnVec   = zeros(100,7);
ArraySheetVec  = zeros(100,7);
ArrayLinkedVec = zeros(100,7);

% YarnVec is [ Density (kg/m3), Strength (MPa), Stiffness (GPa), 
% Ductility (%), Energy to Failure (MJ/m^3), 
% Electrical Conductivity (s/cm), Thermal Conductivity (W/mk); 

%--YARNS------------------------------------------------------------------%

% Ali E. Aliev, Csaba Guthy, Mei Zhang, Shaoli Fang, Anvar A. Zakhidov,
% John E. Fischer, Ray H. Baughman. "Thermal transport in MWNT sheets and 
% yarns" Carbon 45 (2007), pp. 2880-2888.
% [N.B. Also contains some results for direct-drawn sheets.]

ArrayYarnVec(1,1) = 800.0;   ArrayYarnVec(1,6) = 303;   ArrayYarnVec(1,7) = 26;

% Ken R. Atkinson, Stephen C. Hawkins, Chi Huynh, Chris Skourtis, Jane Dai,
% Mei Zhang, Shaoli Fang, Anvar A. Zakhidov, Sergey B. Lee, Ali E. Aliev,
% Christopher D. Williams, Ray H. Baughman. "Multifunctional carbon nanotube yarns and
% transparent sheets: Fabrication, properties and applications". Physica B,
% 394 (2007), 339-343.
% [N.B. Nice data for sheets as well...]

ArrayYarnVec(2,1) = 1033;    ArrayYarnVec(2,2) = 690.0;  ArrayYarnVec(1,3) = 12.14;
ArrayYarnVec(2,4) = 5.95;    ArrayYarnVec(2,5) = 21.7;

% Natnael Behabtu, Micah J. Green, Matteo Pasquali. "Carbon nanotube-based neat
% fibers" Nanotoday 3 (2008), pp. 24-34.
% [Excellent Review, which should be investigated seperately!]

% Alexander E. Bogdanovich, Philip D. Bradford. 
% "Carbon nanotube yarn and 3D braid composites:
% part I: tensile testing and mechanical properties analysis". Composites
% Part. A, 41 (2010) pp. 230-237.
% [N.B: Here: data for dry braided yarn; in addition there are composites,
% which can be included later...]

    % 5-ply dry yarn:
ArrayYarnVec(3,1) = 670;    ArrayYarnVec(3,2) = 190.4;  ArrayYarnVec(3,3) = 3.0;
ArrayYarnVec(3,4) = 9.0;    ArrayYarnVec(3,5) = 8.568; 
    % 25-ply dry yarn:
ArrayYarnVec(4,1) = 670;    ArrayYarnVec(4,2) = 127.5;  ArrayYarnVec(4,3) = 2.4;
ArrayYarnVec(4,4) = 4.6;    ArrayYarnVec(4,5) = 2.933;
    % 3D braid
ArrayYarnVec(5,1) = 670;    ArrayYarnVec(5,2) = 173.6;  ArrayYarnVec(5,3) = 4.0;
ArrayYarnVec(5,4) = 6.5;    ArrayYarnVec(5,5) = 5.642;

% Tsu-Wei Chou, Limin Gao, Erik T. Thostenson, Zuoguang Zhang, Joon-Hyung Byun. 
% "An assessment of the science and technology
% of carbon nanotube-based fibers and composites". Composites Science & Technology
% 70 (2010) pp. 1-19. 
% [Excellent review- pick up later.]

% Fei Deng, Weibang Lu, Haibo Zhao, Yuntian Zhu, Byung-Sun Kim, Tsu-Wei Chou.
% "The properties of dry-spun carbon nanotube fibers and their interfacial
% shear strength in an epoxy composite". Carbon 49 (2011), pp. 1752-1757

                            ArrayYarnVec(6,2) = 309;    ArrayYarnVec(6,3) = 3.0;
ArrayYarnVec(6,4) = 9.2;    ArrayYarnVec(6,5) = 14.21;

% Kaili Jiang, Qunqing Li, Shoushan Fan. "Nanotechnology: Spinning continuous 
% carbon nanotube yarns". Nature 419 (2002), pp. 801.

% Jiang ... Fan. "Nanotechnology: spinning continuous carbon nanotube
% yarns- carbon nanotubes weave their way into a range of imaginative
% [Great source paper for other references on yarns!]

% Kaili Jiang, Jiaping Wang, Qunqing Li, Liang Liu, Changhong Liu, Shoushan Fan.
% "Superaligned carbon nanotube arrays, films, and yarns: a road to applications".
% Advanced materials 23 (2011), pp. 1154-1161.
% [Slightly weak review, but plenty of data referenced.]

% Shaoli Fang, Mei Zhang, Anvar A. Zakhidov, Ray H. Baughman. "Structure and
% process-dependent properties of solid-state spun carbon nanotube yarns".
% Journal of Physics and Condensed Matter 22 (2010), pp. 334221.

    % 160 micron forest:
ArrayYarnVec(7,1) = 800.0;  ArrayYarnVec(7,2) = 325.0;  
ArrayYarnVec(7,4) = 3.25;   ArrayYarnVec(7,5) = 5.36;
ArrayYarnVec(7,6) = 465;
    % 240 micron forest:
ArrayYarnVec(8,1) = 800;    ArrayYarnVec(8,2) = 360.0;
ArrayYarnVec(8,4) = 10.8;   ArrayYarnVec(8,5) = 18.0;
    % 390 micron forest:
ArrayYarnVec(9,1) = 800;    ArrayYarnVec(9,2) = 430.0;
ArrayYarnVec(9,4) = 9.8;    ArrayYarnVec(9,5) = 13.76;

% Menghe Miao. "Electrical conductivity of pure carbon nanotube yarns".
% Carbon 49 (2011) pp. 3755-3761.

ArrayYarnVec(10,1) = 827;   ArrayYarnVec(10,6) = 370.0;
ArrayYarnVec(11,1) = 722;   ArrayYarnVec(11,6) = 300.0;
ArrayYarnVec(12,1) = 572;   ArrayYarnVec(12,6) = 320.0;
ArrayYarnVec(13,1) = 493;   ArrayYarnVec(13,6) = 220.0;
ArrayYarnVec(14,1) = 422;   ArrayYarnVec(14,6) = 190.0;
ArrayYarnVec(15,1) = 387;   ArrayYarnVec(15,6) = 150.0;

% Menghe Miao, Stephen C. Hawkins, Jackie Y. Cai, Thomas R. Gengenbach, 
% Robert Knott, Chi P. Huynh. "Effect of gamma-irradiation on the mechanical properties
% of carbon nanotube yarns". Carbon 49 (2011) pp. 4940-4947.

ArrayYarnVec(16,1) = 603.61; ArrayYarnVec(16,2) = 300;
ArrayYarnVec(17,1) = 576.36; ArrayYarnVec(17,2) = 250;
ArrayYarnVec(18,1) = 484.47; ArrayYarnVec(18,2) = 220;
ArrayYarnVec(19,1) = 546.21; ArrayYarnVec(19,2) = 240;

% Xiefei Zhang, Qingwen Li, Yi Tu, Yuan Li, James Y. Coulter, Lianxi Zheng,
% Yonghao Zhao, Qianxi Jia, Dean E. Peterson, Yuntian Zhu. 
% "Strong carbon-nanotube fibers spun from long carbon-nanotube arrays". 
% Small 3 (2007), pp. 244-248.

                            ArrayYarnVec(20,2) = 850;   ArrayYarnVec(20,3) = 275;
                            ArrayYarnVec(20,4) = 2.21;
                            ArrayYarnVec(21,2) = 170;   ArrayYarnVec(21,3) = 89;
                            ArrayYarnVec(21,4) = 1.83;  ArrayYarnVec(21,5) = 1.8;
                            ArrayYarnVec(22,2) = 1910;  ArrayYarnVec(22,3) = 330;
                            ArrayYarnVec(22,4) = 7.02;  ArrayYarnVec(22,5) = 89;
                            ArrayYarnVec(23,2) = 410;   ArrayYarnVec(23,3) = 241;
                            ArrayYarnVec(23,4) = 2.43;
                            

% Xiefei Zhang, Qingwen Li, Terry G. Holesinger, Paul N. Arendt, Jianyu Huang,
% P. Douglas Kirven, Timothy G. Clapp, Raymond F. DePaula, Xiazhou Liao, 
% Yonghao Zhao, Lianxi Zheng, Dean E. Peterson, Yuntian Zhu.
% "Ultrastrong, stiff and lightweight carbon nanotube fibres". 
% Advanced materials 19 (2007), pp. 4198-4201.

ArrayYarnVec(24,1) = 200.0; %ArrayYarnVec(24,2) = 3300;  %ArrayYarnVec(24,3) = 205;
ArrayYarnVec(24,4) = 8.94;  %ArrayYarnVec(24,5) = 195;
ArrayYarnVec(25,1) = 200.0; %ArrayYarnVec(25,2) = 2640;  %ArrayYarnVec(25,3) = 263;
ArrayYarnVec(25,4) = 8.21;  %ArrayYarnVec(25,5) = 89.8;
ArrayYarnVec(26,1) = 200.0; %ArrayYarnVec(26,2) = 1380;  %ArrayYarnVec(26,3) = 177;
ArrayYarnVec(26,4) = 4.60;  %ArrayYarnVec(26,5) = 27.4;
ArrayYarnVec(27,1) = 200.0; %ArrayYarnVec(27,2) = 1540;  %ArrayYarnVec(27,3) = 257;
ArrayYarnVec(27,4) = 7.51;  %ArrayYarnVec(27,5) = 23.0;
ArrayYarnVec(28,1) = 200.0; %ArrayYarnVec(28,2) = 1940;  %ArrayYarnVec(28,3) = 100;
ArrayYarnVec(28,4) = 2.36;  %ArrayYarnVec(28,5) = 22.0;
ArrayYarnVec(29,1) = 200.0; %ArrayYarnVec(29,2) = 1620;  %ArrayYarnVec(29,3) = 186;
ArrayYarnVec(29,4) = 3.67;  %ArrayYarnVec(29,5) = 52.6;
ArrayYarnVec(30,1) = 200.0; %ArrayYarnVec(30,2) = 1410;  %ArrayYarnVec(30,3) = 172;
ArrayYarnVec(30,4) = 3.47;  %ArrayYarnVec(30,5) = 42.2;
ArrayYarnVec(31,1) = 200.0; %ArrayYarnVec(31,2) = 1350;  %ArrayYarnVec(31,3) = 198;
ArrayYarnVec(31,4) = 3.50;  %ArrayYarnVec(31,5) = 41.8;

% Shanju Zhang, Lingbo Zhu, Marilyn L. Minus, Han Gi Chae, Sudhakar Jagannathan,
% Ching-Ping Wong, Janusz Kowalik, Luke B. Robertson, Satish Kumar.
% "Solid-state spun fibers and yarns from 1-mm long carbon nanotube forests 
% synthesized by water-assisted chemical vapor deposition".
% Journal of Materials Science 43 (2008), pp. 4356-4362.

ArrayYarnVec(32,1) = 780;   ArrayYarnVec(32,2) = 350;   ArrayYarnVec(32,3) = 25;
ArrayYarnVec(32,4) = 2.2;   ArrayYarnVec(32,5) = 3.9;
ArrayYarnVec(33,1) = 1230;  ArrayYarnVec(33,2) = 400;   ArrayYarnVec(33,3) = 10;
ArrayYarnVec(33,4) = 5.0;   ArrayYarnVec(33,5) = 13.5;
ArrayYarnVec(34,1) = 875;   ArrayYarnVec(34,2) = 500;   ArrayYarnVec(34,3) = 8;
ArrayYarnVec(34,4) = 11.0;  ArrayYarnVec(34,5) = 26.25;

% Junbeom Park, Kun-Hong Lee. "Carbon Nanotube Yarns". 
% Korean Journal of Chemical Engineering 29 (2012) pp. 277-287 
% [Another review of properties: lots of further papers.]

% Kai Liu, Yinghui Sun, Ruifeng Zhou, Hanyu Zhu, Jiaping Wang,
% Liang Liu, Shoushan Fan, Kaili Jiang. 
% "Carbon nanotube yarns with high tensile strength made by a twisting and 
% shrinking method". Nanotechnology, 21(2010), 045708.

ArrayYarnVec(35,1) = 385;   ArrayYarnVec(35,2) = 630;   ArrayYarnVec(35,3) = 48;
ArrayYarnVec(35,4) = 2.3;   ArrayYarnVec(35,5) = 6.81;  ArrayYarnVec(35,6) = 667.0;

ArrayYarnVec(36,1) = 643;   ArrayYarnVec(36,2) = 1100;  ArrayYarnVec(36,3) = 56;
ArrayYarnVec(36,4) = 2.3;   ArrayYarnVec(36,5) = 12.65; ArrayYarnVec(36,6) = 885.0;

% Mei Zhang, Ken R. Atkinson, Ray H. Baughman. 
% "Multifunctional carbon nanotube yarns by downsizing an ancient technology". 
% Science 306 (2004), pp. 1358-1361.

ArrayYarnVec(37,1) = 800;   ArrayYarnVec(37,2) = 354;   
ArrayYarnVec(37,4) = 7.3;   ArrayYarnVec(37,5) = 11.2;  
ArrayYarnVec(37,6) = 300;

% Jiangtao Di, Shaoli Fang, Francisco A. Moura, Douglas S. Galvão, Julia Bykova,
% Ali Aliev, Mônica Jung de Andrade, Xavier Lepró, Na Li, Carter Haines, 
% Raquel Ovalle-Robles, Dong Qian, Ray H. Baughman.
% "Strong, twist-stable carbon nanotube yarns and muscles by tension annealing at 
% extreme temperatures".
% Advanced Materials 28 (2016), pp. 6598-6605.

ArrayYarnVec(38,1) = 500;	ArrayYarnVec(38,2) = 350;	ArrayYarnVec(38,3) = 6.6;

% Jandro L. Abot, Tareq Alosh, Kalayu Belay. "Strain dependence of electrical 
% resistance in carbon nanotube yarns".
% Carbon 70 (2014) pp. 95-102.

ArrayYarnVec(39,1) = 900;	ArrayYarnVec(39,2) = 1250;	ArrayYarnVec(39,3) = 71;
ArrayYarnVec(39,6) = 2270;

% Yoshinobu Shimamura, Kahori Oshima, Keiichiro Tohgo, Tomoyuki Fujii, 
% Keiichi Shirasu, Go Yamamoto, Toshiyuki Hashida, Ken Goto, Toshio Ogasawara,
% Kimiyoshi Naito, Takayuki Nakano, Yoku Inoue.
% "Tensile mechanical properties of carbon nanotube/epoxy composite fabricated
% by pultrusion of carbon nanotube spun yarn preform"
% Composites: Part A 62 (2014), pp. 32-38.

ArrayYarnVec(40,1) = 550;	ArrayYarnVec(40,2) = 175;	ArrayYarnVec(40,3) = 9.4;
ArrayYarnVec(40,4) = 2.69;	ArrayYarnVec(40,5) = 2.35;

% Jackie Y. Cai, Jie Min, Jill McDonnell, Jeffrey S. Church, Christopher D. Easton,
% William Humphries, Stuart Lucas, Andrea L. Woodhead. 
% "An improved method for functionalisation of carbon nanotube spun yarns with 
% aryldiazonium compounds".
% Carbon 50 (2012), pp. 4655-4662.

ArrayYarnVec(41,1) = 1000; ArrayYarnVec(41,2) = 830;	ArrayYarnVec(41,3) = 40;
ArrayYarnVec(41,5) = 14;

% Adrian Ghemes, Yoshitaka Minami, Junichi Muramatsu, Morihiro Okada, Hidenori Mimura,
% Yoku Inoue.
% "Fabrication and mechanical properties of carbon nanotube yarns spun from ultra-long
% multi-walled carbon nanotube arrays".
% Carbon 50 (2012), pp. 4579-4587.

ArrayYarnVec(42,1) = 730;	ArrayYarnVec(42,2) = 418;	ArrayYarnVec(42,3) = 30.6;
ArrayYarnVec(43,1) = 1240;	ArrayYarnVec(43,2) = 772;	ArrayYarnVec(43,3) = 51.1;

ArrayYarnVec(44,1) = 1250;	ArrayYarnVec(44,2) = 859;	ArrayYarnVec(44,3) = 41;
ArrayYarnVec(45,1) = 1380;	ArrayYarnVec(45,2) = 783;	ArrayYarnVec(45,3) = 19;
ArrayYarnVec(46,1) = 1370;	ArrayYarnVec(46,2) = 566;	ArrayYarnVec(46,3) = 22;
ArrayYarnVec(47,1) = 1420;	ArrayYarnVec(47,2) = 541;	ArrayYarnVec(47,3) = 13;
ArrayYarnVec(48,1) = 1500;	ArrayYarnVec(48,2) = 467;	ArrayYarnVec(48,3) = 14;
ArrayYarnVec(49,1) = 1550;	ArrayYarnVec(49,2) = 364;	ArrayYarnVec(49,3) = 6;
 
ArrayYarnVec(50,1) = 830;	ArrayYarnVec(50,2) = 383;	ArrayYarnVec(50,3) = 11;
ArrayYarnVec(51,1) = 990;	ArrayYarnVec(51,2) = 643;	ArrayYarnVec(51,3) = 23;
ArrayYarnVec(52,1) = 1030;	ArrayYarnVec(52,2) = 845;	ArrayYarnVec(52,3) = 28;
ArrayYarnVec(53,1) = 1250;	ArrayYarnVec(53,2) = 867;	ArrayYarnVec(53,3) = 41;
ArrayYarnVec(54,1) = 1320;	ArrayYarnVec(54,2) = 946;	ArrayYarnVec(54,3) = 50;
ArrayYarnVec(55,1) = 1530;	ArrayYarnVec(55,2) = 1061;	ArrayYarnVec(55,3) = 51;

ArrayYarnVec(56,1) = 570;	ArrayYarnVec(56,2) = 300;	ArrayYarnVec(56,3) = 36;
ArrayYarnVec(57,1) = 1120;	ArrayYarnVec(57,2) = 676;	ArrayYarnVec(57,3) = 34;
ArrayYarnVec(58,1) = 1890;	ArrayYarnVec(58,2) = 1068;	ArrayYarnVec(58,3) = 55;

% Mei Zu, Qingwen Li, Yuntian Zhu, Yong Zhu, Guojian Wang, Joon-Hyung Byun, 
% Tsu-Wei Chou.
% "Stress relaxation in carbon nanotube-based fibers for load-bearing applications"
% Carbon 52 (2013) pp. 347-355.

ArrayYarnVec(59,1) = 1507;	ArrayYarnVec(59,2) = 1200;	ArrayYarnVec(59,3) = 53;
ArrayYarnVec(59,5) = 13.5;	


%--SHEETS-----------------------------------------------------------------%

% Mei Zhang, Shaoli Fang, Anvar A. Zakhidov, Sergey B. Lee, Ali E. Aliev,
% Christopher D. Williams, Ken R. Atkinson, Ray H. Baughman.
% "Strong, transparent, multifunctional, carbon nanotube sheets".
% Science 309 (2005), pp. 1215-1219.

    % Freestanding CNT sheet
ArraySheetVec(1,1) = 1.5;   ArraySheetVec(1,2) = 0.198;
ArraySheetVec(1,6) = 0.794;
    % Densified CNT sheet
ArraySheetVec(2,1) = 500;   ArraySheetVec(2,2) = 232.5;
ArraySheetVec(2,6) = 285.7;

% Ken R. Atkinson, Stephen C. Hawkins, Chi Huynh, Chris Skourtis, Jane Dai,
% Mei Zhang, Shaoli Fang, Anvar A. Zakhidov, Sergey B. Lee, Ali E. Aliev,
% Christopher D. Williams, Ray H. Baughman.
% "Multifunctional carbon nanotube yarns and transparent sheets: fabrication,
% properties and applications".
% Physica B: Condensed Mater 394 (2007), pp. 339-343.
% [same data as the above.]

% Ali E. Aliev, Csaba Guthy, Mei Zhang, Shaoli Fang, Anvar A. Zakhidov, 
% John E. Fischer, Ray H. Baughman. "Thermal transport in MWCNT sheets and
% yarns" Carbon 45 (2007), pp. 2880-2888.
% [Sheets drawn from a forest, thickness of 18-20 micron.]

ArraySheetVec(3,1) = 1.5;	ArraySheetVec(3,7) = 0.14;

% Liwen Zhang, Xin Wang, Weizong Xu, Yongyi Zhang, Qingwen Li, Philip D. Bradford,
% Yuntian Zhu. "Strong and conductive dry carbon nanotube films by microcombing"
% Small 11 (2015), pp. 3830-3836.

	% Uncombed
ArraySheetVec(4,1) = 840;	ArraySheetVec(4,2) = 1561;	ArraySheetVec(4,3) = 151;
ArraySheetVec(4,6) = 1000;
	% Combed
ArraySheetVec(5,1) = 1040;	ArraySheetVec(5,2) = 3206;	ArraySheetVec(5,3) = 172;
ArraySheetVec(5,6) = 1800;

% Ding Wang, Pengcheng Song, Canghong Liu, Wei Wu, Shoushan Fan. 
% "Highly oriented carbon nanotube papers made of aligned carbon nanotubes"
% Nanotechnology 19 (2008), 075609.

ArraySheetVec(6,1) = 620;	ArraySheetVec(6,6) = 200;	ArraySheetVec(6,7) = 153;

% Yoku Inoue, Yusuke Suzuki, Yoshitaka Minami, Junichi Muramatsu, Yoshinobu Shimamura,
% Katsunori Suzuki, Adrian Ghemes, Morihiro Okada, Shingo Sabakibara,
% Hidenori Mimura, Kimiyoshi Naito.
% "Anisotropic carbon nanotube papers fabricated from multiwalled carbon nanotube webs"
% Carbon 49 (2011), pp. 2437-2443.

ArraySheetVec(7,1) = 840;	ArraySheetVec(7,2) = 76;	ArraySheetVec(7,3) = 2.1;
ArraySheetVec(7,6) = 400;	ArraySheetVec(7,7) = 70;

% Jiangtao Di, Dongmei Hu, Hongyuan Chen, Zhenzhong Yong, Minghai Chen, Zhihai Feng,
% Yuntian Zhu, Qingwen Li. 
% "Ultrasrong, foldable, and highly conductive carbon nanotube film"
% ACS Nano 6 (2012), pp. 5457-5464.

	% As Prepared:
ArraySheetVec(8,1) = 600;	ArraySheetVec(8,2) = 500;	ArraySheetVec(8,3) = 13.6;
	% Solvent Densified:
ArraySheetVec(9,1) = 900;	ArraySheetVec(9,2) = 1500;	ArraySheetVec(9,3) = 66;
ArraySheetVec(9,6) = 350;

% Yanjie Wang, Min Li, Yizhuo Gu, Xiaohua Zhang, Shaokai Wang, Qingwen Li, 
% Zuoguang Zhang. "Tuning carbon nanotube assembly for flexible, strong and
% conductive films". Nanoscale 7 (2015), pp. 3060-3066.

	% SW Film
ArraySheetVec(10,1) = 675;	ArraySheetVec(10,2) =  1000;	ArraySheetVec(10,3) = 46;
ArraySheetVec(10,6) = 116;
	% EDD Film
ArraySheetVec(11,1) = 1210;	ArraySheetVec(11,2) = 2500;		ArraySheetVec(11,3) = 137;
ArraySheetVec(11,6) = 318;
	% ADD Film
ArraySheetVec(12,1) = 1350;	ArraySheetVec(12,2) = 3080;		ArraySheetVec(12,3) = 112;
ArraySheetVec(12,6) = 349;



%--CROSSLINKED-FROM-ARRAY-------------------------------------------------%

% Menghe Miao, Stephen C. Hawkins, Jackie Y. Cai, Thomas R. Gengenbach, 
% Robert Knott, Chi P. Huynh. 
% "Effect of gamma-irradiation on the mechanical properties
% of carbon nanotube yarns". Carbon 49 (2011) pp. 4940-4947.

ArrayLinkedVec(1,1) = 706.78;   ArrayLinkedVec(1,2) = 390;
ArrayLinkedVec(2,1) = 672.27;   ArrayLinkedVec(2,2) = 350;
ArrayLinkedVec(3,1) = 746.13;   ArrayLinkedVec(3,2) = 370;
ArrayLinkedVec(4,1) = 605.58;   ArrayLinkedVec(4,2) = 310;

% A. V. Krasheninnikov, F. Banhart. "Engineering of nanostructured carbon materials
% with electron or ion beams". Review, Nature Materials 6 (2007), pp. 723-733.
% [About e-crosslinking by radiation- useful review.]

ArrayLinkedVec(5,1) = 320;      ArrayLinkedVec(5,2) = 38.4;  ArrayLinkedVec(5,3) = 2.56;
ArrayLinkedVec(6,1) = 420;      ArrayLinkedVec(6,2) = 222.6; ArrayLinkedVec(6,3) = 5.88;
ArrayLinkedVec(7,1) = 550;      ArrayLinkedVec(7,2) = 385;   ArrayLinkedVec(7,3) = 6.05;
ArrayLinkedVec(8,1) = 750;      ArrayLinkedVec(8,2) = 427.5; ArrayLinkedVec(8,3) = 7.125;
ArrayLinkedVec(9,1) = 1000;     ArrayLinkedVec(9,2) = 330;   ArrayLinkedVec(9,3) = 4.0;

end

