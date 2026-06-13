%— your data (11 bars × 3 groups) —%
% rows: Parent, P1, …, P10
freeEnds     = [0.53,0.13,0.25,0.26,0.22,0.21,0.24,0.27,0.31,0.33,0.34];
crossedNodes = [0.20,0.20,0.02,0.13,0.15,0.14,0.11,0.09,0.07,0.07,0.05];
interwoven   = 1 - (freeEnds + crossedNodes);

N = [ freeEnds'   crossedNodes'   interwoven' ];

figure('Color','w');
b = bar(N, 'stacked', 'EdgeColor','k', 'LineWidth',1.2);

% assign pastel colors that “go” with your hatches
colors = [ ...
    0.85 0.85 0.85;   ...  % Free ends — light gray  
    0.50 0.50 0.50;   ...  % Crossed nodes — medium gray
    0.15 0.15 0.15       % Interwoven nodes — dark gray
    ];

hatchStyles = {'/','x','\\'};  

for k = 1:3
    % assign the hatch style
    b(k).HatchStyle   = hatchStyles{k};
    b(k).HatchColor   = [0 0 0];   % black hatch lines
    b(k).HatchAngle   = 45;        % 45° lines
    b(k).HatchDensity = 30;        % fine enough
end

% tidy up axes
set(gca, ...
    'XTick',        1:11, ...
    'XTickLabel',   {'Parent','P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'}, ...
    'YLim',         [0 1], ...
    'TickDir',      'in', ...
    'Box',          'on' );

legend({'Free Ends','Crossed nodes','Interwoven nodes'}, ...
       'Location','northeastoutside');

ylabel('Node/Free end fraction');
xlabel('CNT Particle ID');
