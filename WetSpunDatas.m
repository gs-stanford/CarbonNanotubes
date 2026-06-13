function [WetSpunVec] = WetSpunDatas()

WetSpunVec = zeros(100,7);

% WetSpunVec is [ Density (kg/m3), Strength (MPa), Stiffness (GPa), 
% Ductility (%), Energy to Failure (MJ/m^3), 
% Electrical Conductivity (s/cm), Thermal Conductivity (W/mk); 

%--DATAS------------------------------------------------------------------%

% Lars M. Ericson, Hua Fan, Haiqing Peng, Virginia A. Davis, Wei Zhou,
% Joseph Sulpizio, Yuhuang Wang, Richard Brooker, Juraj Vavro, Csaba Guthy,
% A. Nicholas G. Parra-Vasquez, Myung Jong Kim, Sivarajan Ramesh, Rajesh K. Saini,
% Carter Kittrell, Gerry Lavin, Howard Schmidt, W. Wade Adams, W. E. Billups, 
% Matteo Pasquali, Wen-Fang Hwang, Robert H. Hauge, John E. Fischer, 
% Richard E. Smalley.
% "Macroscopic, neat, single-walled carbon nanotube fibers". 
% Science 305 (2004), pp. 1447-1450.

WetSpunVec(1,1) = 870;	WetSpunVec(1,2) = 116;	WetSpunVec(1,3) = 120;
WetSpunVec(1,6) = 5000;	WetSpunVec(1,7) = 21;

% Chengmin Jiang, Avishek Saha, Colin C. Young, Daniel Paul Hashim,
% Carolyn E. Ramirez, Pulickel M. Ajayan, Matteo Pasquali, Angel A. Marti.
% "Macroscopic nanotube fibers spun from single-walled carbon nanotube 
% polyelectrolytes". ACS Nano 8 (2014), pp. 9107-9112.

WetSpunVec(2,1) = 1000;	WetSpunVec(2,2) = 65;	WetSpunVec(2,3) = 12;
WetSpunVec(2,4) = 0.6;	WetSpunVec(2,6) = 147;
WetSpunVec(3,1) = 1000;	WetSpunVec(3,2) = 105;	WetSpunVec(3,3) = 14;
WetSpunVec(3,4) = 1.3;	WetSpunVec(3,6) = 170;
WetSpunVec(4,1) = 1000;	WetSpunVec(4,2) = 52;	WetSpunVec(4,3) = 8;
WetSpunVec(4,4) = 0.61;	WetSpunVec(4,6) = 90;

% L. Piraux, F. Abreu Araujo, T. N. Biu. 
% "Two-dimensional quantum transport in highly conductive carbon nanotube fibers".
% Physical Review B 92 (2015), 085428.

WetSpunVec(5,1) = 1300;		WetSpunVec(5,6) = 67000;
WetSpunVec(6,1) = 1300;		WetSpunVec(6,6) = 38000;
WetSpunVec(7,1) = 1100;		WetSpunVec(7,6) = 18000;

% Natnael Behabtu, Colin C. Young, Dmitri E. Tsentalovich, Olga Kleinerman,
% Xuan Wang, Anson W. K. Ma, Amram Bengio, Ron F. ter Waarbeek, Jorrit J. de Jong,
% Ron E. Hoogerwerf, Steven B. Fairchild, John B. Ferguson, Benji Maruyama,
% Junichiro Kono, Yeshayahu Talmon, Yachin Cohen, Marcin J. Otto, Matteo Pasquali.
% "Strong, light, multifunctional fibers of carbon nanotubes with ultrahigh conductivity"
% Science 339 (2013), pp. 182-186.

WetSpunVec(8,1) = 1300;		WetSpunVec(8,2) = 1000; 	WetSpunVec(8,3) = 120;
WetSpunVec(8,4) = 1.4;		WetSpunVec(8,6) = 29000;	WetSpunVec(8,7) = 380;

WetSpunVec(9,1) = 1400;		WetSpunVec(9,6) = 50000;	WetSpunVec(9,7) = 635;
WetSpunVec(10,1)= 1400;		WetSpunVec(10,6)= 4000;  

% Francesca Mirri, Nathan D. Orloff, Aaron M. Forster, Rana Ashkar, Robert J. Headrick,
% E. Amram Bengio, Christian J. Long, April Choi, Yimin Luo, Angela R. Hight Walker,
% Paul Butler, Kalman B. Migler, Matteo Pasquali.
% "Lightweight, flexible, high-performance carbon nanotube cables made by scalable flow 
% coating".
% Applied Materials & Interfaces 8 (2016), pp. 4903-4910.

WetSpunVec(11,1) = 440;		WetSpunVec(11,6) = 6600;

% Don Shiffler, Steve Fairchild, Wilkin Tang, Benji Maruyama, Ken Golby, Matthel LaCour, 
% Matteo Pasquali, Nathaniel Lockwood.
% "Demonstration of an acid-spun single-walled nanotube fiber cathode"
% IEEE Transactions on Plasma Science 40 (2012), pp. 1871-1877.

WetSpunVec(12,1) = 1100;	WetSpunVec(12,2) = 50;		WetSpunVec(12,3) = 100;
WetSpunVec(12,6) = 5000;	
WetSpunVec(13,1) = 1100;	WetSpunVec(13,2) = 200;		WetSpunVec(13,3) = 120;
WetSpunVec(13,6) = 500;		WetSpunVec(13,7) = 20;

% S. B. Fairchild, J. Boeckl, T. C. Back, J. B. Ferguson, H. Koerner, 
% P. T. Murray, B. Maruyama, M. A. Lange, M. M. Cahay, N. Behabtu, C. C. Young,
% M. Pasquali, N. P. Lockwood, K. L. Averett, G. Grun, D. E. Tsentalovich.
% "Morphology dependent field emission of acid-spun carbon nanotube fibers"
% Nanotechnology 26 (2015) 105706.


WetSpunVec(14,1) = 870;		WetSpunVec(14,6) = 83;		WetSpunVec(14,7) = 1;
WetSpunVec(15,1) = 1110;	WetSpunVec(15,6) = 250;		WetSpunVec(15,7) = 9;
WetSpunVec(16,1) = 1110;	WetSpunVec(16,6) = 300;		WetSpunVec(16,7) = 23;
WetSpunVec(17,1) = 1330;	WetSpunVec(17,6) = 5700;	WetSpunVec(17,7) = 100;

% Xuan Wang, Natnael Behabtu, Colin C. Young, Dmitri E. Tsentalovich, Matteo Pasquali,
% Junichiro Kono.
% "High-ampacity power cables of tightly-packed and aligned carbon nanotubes"
% Advanced Functional Materials 24 (2014), pp. 3241-3249.

WetSpunVec(18,1) = 1460;	WetSpunVec(18,6) = 38460;	WetSpunVec(18,7) = 420;
WetSpunVec(19,1) = 1212;	WetSpunVec(19,6) = 24100;	WetSpunVec(19,7) = 331;
WetSpunVec(20,1) = 1212;	WetSpunVec(20,6) = 25000;	WetSpunVec(20,7) = 314;

end